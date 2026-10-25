import type { RequestHandler } from 'express';
import { prepared } from '../../db/pool';
import { notFound } from '../../lib/httpError';
import { toProjectContext } from '../projects/access';

export interface TaskContext {
  id: string;
  projectId: string;
  number: number;
  parentId: string | null;
  reporterId: string | null;
  assigneeId: string | null;
}

interface TaskAccessRow {
  task_id: string;
  number: number;
  parent_id: string | null;
  reporter_id: string | null;
  assignee_id: string | null;
  id: string;
  key: string;
  owner_id: string;
  archived_at: Date | null;
  permissions: number;
  role_id: string;
  role_name: string;
}

const LOAD_TASK = `
  SELECT t.id AS task_id, t.number, t.parent_id, t.reporter_id, t.assignee_id,
         p.id, p.key::text, p.owner_id, p.archived_at, r.permissions, r.id AS role_id, r.name AS role_name
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
  JOIN project_roles r ON r.id = m.role_id
  WHERE t.id = $1`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const loadTaskAccess = async (taskId: string, userId: string) => {
  if (!UUID.test(taskId)) return null;
  const [row] = await prepared<TaskAccessRow>('load-task', LOAD_TASK, [taskId, userId]);
  if (!row) return null;
  return {
    project: toProjectContext(row, userId),
    task: {
      id: row.task_id,
      projectId: row.id,
      number: row.number,
      parentId: row.parent_id,
      reporterId: row.reporter_id,
      assigneeId: row.assignee_id,
    } satisfies TaskContext,
  };
};

export const loadTask: RequestHandler = async (req, _res, next) => {
  const access = await loadTaskAccess(String(req.params.taskId), req.user!.id);
  if (!access) throw notFound('Task not found');
  req.project = access.project;
  req.task = access.task;
  next();
};
