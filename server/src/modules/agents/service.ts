import { randomUUID } from 'node:crypto';
import type { AiWorker } from '@msr/shared/types';
import { query, queryOne, transaction } from '../../db/pool';
import { notFound } from '../../lib/httpError';
import type { UserRow } from '../users/service';

interface WorkerRow {
  id: string;
  name: string;
  created_at: Date;
  grant_id: string | null;
  client_name: string | null;
  projects: AiWorker['projects'];
}

const LIST_WORKERS = `
  SELECT u.id, u.name, u.created_at, g.id AS grant_id, c.metadata->>'client_name' AS client_name,
         coalesce((SELECT json_agg(json_build_object('key', p.key, 'name', p.name, 'role', r.name) ORDER BY p.name)
                   FROM project_members m JOIN projects p ON p.id = m.project_id JOIN project_roles r ON r.id = m.role_id
                   WHERE m.user_id = u.id), '[]') AS projects
  FROM users u
  LEFT JOIN oauth_grants g ON g.agent_id = u.id
  LEFT JOIN oauth_clients c ON c.id = g.client_id
  WHERE u.agent_owner_id = $1
  ORDER BY u.created_at`;
const CREATE_WORKER = `
  WITH free_grant AS (
    SELECT id FROM oauth_grants
    WHERE id = $2 AND user_id = $1 AND agent_id IS NULL AND refresh_expires_at > now()
    FOR UPDATE
  ), worker AS (
    INSERT INTO users (email, name, preferences, agent_owner_id)
    SELECT $3, $4, jsonb_strip_nulls(jsonb_build_object('timezone', o.preferences->'timezone')), $1
    FROM free_grant, users o WHERE o.id = $1
    RETURNING id
  )
  UPDATE oauth_grants g SET agent_id = worker.id FROM worker WHERE g.id = $2 RETURNING worker.id`;
const OWN_WORKER = 'SELECT id, name, email FROM users WHERE id = $1 AND agent_owner_id = $2';
const RENAME = 'UPDATE users SET name = $3, updated_at = now() WHERE id = $1 AND agent_owner_id = $2';
const DROP_OLD_GRANT = 'DELETE FROM oauth_grants WHERE agent_id = $1';
const BIND_GRANT = `
  UPDATE oauth_grants SET agent_id = $1
  WHERE id = $2 AND user_id = $3 AND agent_id IS NULL AND refresh_expires_at > now()
  RETURNING id`;
const UNASSIGN_EVERYWHERE = `
  WITH unassigned AS (
    UPDATE tasks SET assignee_id = NULL, updated_at = now()
    WHERE assignee_id = $1 AND completed_at IS NULL
    RETURNING id, project_id
  )
  INSERT INTO task_activity (project_id, task_id, actor_id, action, field, old_value, new_value)
  SELECT project_id, id, $2, 'updated', 'assignee', to_jsonb($3::text), 'null'::jsonb FROM unassigned`;
const DELETE_WORKER = 'DELETE FROM users WHERE id = $1';

const NO_FREE_GRANT = 'Pick a connected app that is not an AI worker yet';

export const listWorkers = async (ownerId: string): Promise<AiWorker[]> =>
  (await query<WorkerRow>(LIST_WORKERS, [ownerId])).map((row) => ({
    id: row.id,
    name: row.name,
    connection: row.grant_id ? { id: row.grant_id, name: row.client_name?.trim() || 'AI app' } : null,
    projects: row.projects,
    createdAt: row.created_at.toISOString(),
  }));

export const findOwnWorker = async (ownerId: string, workerId: string) => {
  const worker = await queryOne<Pick<UserRow, 'id' | 'name' | 'email'>>(OWN_WORKER, [workerId, ownerId]);
  if (!worker) throw notFound('AI worker not found');
  return worker;
};

export const createWorker = async (ownerId: string, grantId: string, name: string) => {
  const row = await queryOne<{ id: string }>(CREATE_WORKER, [
    ownerId,
    grantId,
    `agent-${randomUUID()}@agents.invalid`,
    name,
  ]);
  if (!row) throw notFound(NO_FREE_GRANT);
  return row.id;
};

export const updateWorker = (ownerId: string, workerId: string, patch: { name?: string; grantId?: string }) =>
  transaction(async (db) => {
    await findOwnWorker(ownerId, workerId);
    if (patch.name) await query(RENAME, [workerId, ownerId, patch.name], db);
    if (patch.grantId) {
      await query(DROP_OLD_GRANT, [workerId], db);
      if (!(await queryOne(BIND_GRANT, [workerId, patch.grantId, ownerId], db)))
        throw notFound(NO_FREE_GRANT);
    }
  });

export const deleteWorker = async (ownerId: string, workerId: string) => {
  const worker = await findOwnWorker(ownerId, workerId);
  await transaction(async (db) => {
    await query(UNASSIGN_EVERYWHERE, [worker.id, ownerId, worker.name], db);
    await query(DELETE_WORKER, [worker.id], db);
  });
};
