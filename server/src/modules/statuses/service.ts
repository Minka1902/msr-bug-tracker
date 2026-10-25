import type { StatusCategory, Workflow } from '@msr/shared/enums';
import type { ProjectStatus } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { badRequest, notFound } from '../../lib/httpError';
import { assertValidPosition, positionAfter } from '../../lib/position';

interface StatusRow {
  id: string;
  workflow: Workflow;
  name: string;
  color: string;
  category: StatusCategory;
  position: string;
}

const STATUS_COLUMNS = 'id, workflow, name, color, category, position';

const LIST_STATUSES = `SELECT ${STATUS_COLUMNS} FROM project_statuses WHERE project_id = $1 ORDER BY workflow, position, created_at`;
const GET_STATUS = `SELECT ${STATUS_COLUMNS} FROM project_statuses WHERE id = $1 AND project_id = $2`;
const LAST_POSITION =
  'SELECT max(position) AS position FROM project_statuses WHERE project_id = $1 AND workflow = $2';
const INSERT_STATUS = `
  INSERT INTO project_statuses (project_id, workflow, name, color, category, position)
  VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${STATUS_COLUMNS}`;
const UPDATE_STATUS = `
  UPDATE project_statuses SET name = COALESCE($3, name), color = COALESCE($4, color), category = COALESCE($5, category),
         position = COALESCE($6, position)
  WHERE id = $1 AND project_id = $2 RETURNING ${STATUS_COLUMNS}`;
const WORKFLOW_HEALTH = `
  SELECT count(*) FILTER (WHERE category IN ('backlog', 'todo'))::int AS open,
         count(*) FILTER (WHERE category = 'done')::int AS done
  FROM project_statuses WHERE project_id = $1 AND workflow = $2`;
const SYNC_COMPLETION = `
  UPDATE tasks SET completed_at = CASE WHEN $2 THEN COALESCE(completed_at, now()) ELSE NULL END, updated_at = now()
  WHERE status_id = $1 AND (completed_at IS NULL) = $2`;
const MOVE_TASKS = `
  WITH moved AS (
    UPDATE tasks t SET status_id = $2,
           completed_at = CASE WHEN target.category = 'done' THEN COALESCE(t.completed_at, now()) ELSE NULL END,
           updated_at = now()
    FROM project_statuses target
    WHERE target.id = $2 AND t.status_id = $1
    RETURNING t.id, t.project_id
  )
  INSERT INTO task_activity (project_id, task_id, actor_id, action, field, old_value, new_value)
  SELECT project_id, id, $3, 'updated', 'status', to_jsonb($4::text), to_jsonb($5::text) FROM moved`;
const DELETE_STATUS = 'DELETE FROM project_statuses WHERE id = $1';

export const toStatus = (row: StatusRow): ProjectStatus => ({ ...row });

export const listStatuses = (projectId: string, db?: Db) =>
  query<StatusRow>(LIST_STATUSES, [projectId], db).then((rows) => rows.map(toStatus));

export const getStatus = (projectId: string, statusId: string, db?: Db) =>
  queryOne<StatusRow>(GET_STATUS, [statusId, projectId], db);

const assertWorkflowHealthy = async (db: Db, projectId: string, workflow: Workflow) => {
  const health = await queryOne<{ open: number; done: number }>(WORKFLOW_HEALTH, [projectId, workflow], db);
  if (!health || health.open < 1 || health.done < 1)
    throw badRequest('Each workflow needs at least one backlog/to-do status and one done status');
};

export const createStatus = async (
  projectId: string,
  input: { workflow: Workflow; name: string; color: string; category: StatusCategory },
) => {
  const last = await queryOne<{ position: string | null }>(LAST_POSITION, [projectId, input.workflow]);
  return queryOne<StatusRow>(INSERT_STATUS, [
    projectId,
    input.workflow,
    input.name,
    input.color,
    input.category,
    positionAfter(last?.position),
  ]).then((row) => toStatus(row!));
};

export const updateStatus = (
  projectId: string,
  statusId: string,
  input: { name?: string; color?: string; category?: StatusCategory; position?: string },
) => {
  if (input.position) assertValidPosition(input.position);
  return transaction(async (db) => {
    const current = await getStatus(projectId, statusId, db);
    if (!current) throw notFound('Status not found');
    const updated = await queryOne<StatusRow>(
      UPDATE_STATUS,
      [
        statusId,
        projectId,
        input.name ?? null,
        input.color ?? null,
        input.category ?? null,
        input.position ?? null,
      ],
      db,
    );
    if (input.category && input.category !== current.category) {
      await assertWorkflowHealthy(db, projectId, current.workflow);
      if ((input.category === 'done') !== (current.category === 'done'))
        await query(SYNC_COMPLETION, [statusId, input.category === 'done'], db);
    }
    return toStatus(updated!);
  });
};

export const deleteStatus = (projectId: string, statusId: string, moveTo: string, actorId: string) =>
  transaction(async (db) => {
    const [current, target] = await Promise.all([
      getStatus(projectId, statusId, db),
      getStatus(projectId, moveTo, db),
    ]);
    if (!current) throw notFound('Status not found');
    if (!target || target.id === current.id || target.workflow !== current.workflow)
      throw badRequest('Move its tasks to another status in the same workflow');
    await query(MOVE_TASKS, [statusId, moveTo, actorId, current.name, target.name], db);
    await query(DELETE_STATUS, [statusId], db);
    await assertWorkflowHealthy(db, projectId, current.workflow);
  });
