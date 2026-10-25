import type { ActivityEntry } from '@msr/shared/types';
import { formatIdentifier } from '@msr/shared/identifiers';
import { query, type Db } from '../../db/pool';
import { avatarUrl } from '../users/service';

export interface ActivityInput {
  projectId: string;
  taskId: string | null;
  actorId: string;
  action: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

interface ActivityRow {
  id: number;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: Date;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_key: string | null;
  task_id: string | null;
  task_number: number | null;
  task_title: string | null;
  project_key: string;
  project_name: string;
  project_color: string;
}

const INSERT_ACTIVITY = `
  INSERT INTO task_activity (project_id, task_id, actor_id, action, field, old_value, new_value)
  SELECT project_id, task_id, actor_id, action, field, old_value::jsonb, new_value::jsonb
  FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::text[])
    AS x(project_id, task_id, actor_id, action, field, old_value, new_value)`;

export const ACTIVITY_SELECT = `
  SELECT e.id, e.action, e.field, e.old_value, e.new_value, e.created_at,
         u.id AS actor_id, u.name AS actor_name, u.avatar_key AS actor_avatar_key,
         t.id AS task_id, t.number AS task_number, t.title AS task_title,
         p.key::text AS project_key, p.name AS project_name, p.color AS project_color
  FROM task_activity e
  JOIN projects p ON p.id = e.project_id
  LEFT JOIN users u ON u.id = e.actor_id
  LEFT JOIN tasks t ON t.id = e.task_id`;

const TASK_ACTIVITY = `${ACTIVITY_SELECT} WHERE e.task_id = $1 ORDER BY e.created_at, e.id`;

const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

export const recordActivity = async (entries: ActivityInput[], db?: Db) => {
  if (!entries.length) return;
  await query(
    INSERT_ACTIVITY,
    [
      entries.map((entry) => entry.projectId),
      entries.map((entry) => entry.taskId),
      entries.map((entry) => entry.actorId),
      entries.map((entry) => entry.action),
      entries.map((entry) => entry.field ?? null),
      entries.map((entry) => json(entry.oldValue)),
      entries.map((entry) => json(entry.newValue)),
    ],
    db,
  );
};

export const toActivity = (row: ActivityRow): ActivityEntry => {
  const deleted =
    !row.task_id && row.new_value && typeof row.new_value === 'object'
      ? (row.new_value as { identifier?: string; title?: string })
      : null;
  return {
    id: row.id,
    action: row.action,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    actor: row.actor_id
      ? { id: row.actor_id, name: row.actor_name!, avatarUrl: avatarUrl(row.actor_id, row.actor_avatar_key) }
      : null,
    task: row.task_id
      ? {
          id: row.task_id,
          identifier: formatIdentifier(row.project_key, row.task_number!),
          title: row.task_title!,
        }
      : deleted?.identifier
        ? { id: '', identifier: deleted.identifier, title: deleted.title ?? '' }
        : null,
    project: { key: row.project_key, name: row.project_name, color: row.project_color },
    createdAt: row.created_at.toISOString(),
  };
};

export const listTaskActivity = (taskId: string) =>
  query<ActivityRow>(TASK_ACTIVITY, [taskId]).then((rows) => rows.map(toActivity));

export type { ActivityRow };
