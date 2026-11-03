import type { RequestHandler } from 'express';
import { prepared } from '../../db/pool';
import { parseIdentifier } from '@msr/shared/identifiers';
import type { ProjectModule } from '@msr/shared/modules';
import { canEditTask, cardTypeAllows, isOwnTask, missingTaskPermissions } from '@msr/shared/permissions';
import type { UpdateTaskInput } from '@msr/shared/schemas/task';
import { forbidden, notFound } from '../../lib/httpError';
import { assertWritable, toProjectContext, type ProjectContext } from '../projects/access';
import { resolveIdentifier } from './service';

export interface TaskContext {
  id: string;
  projectId: string;
  number: number;
  parentId: string | null;
  reporterId: string | null;
  assigneeId: string | null;
  cardType: { name: string; editRoleIds: string[]; restricted: boolean } | null;
}

interface TaskAccessRow {
  task_id: string;
  number: number;
  parent_id: string | null;
  reporter_id: string | null;
  assignee_id: string | null;
  card_type_name: string | null;
  card_type_edit_roles: string[] | null;
  card_type_restricted: boolean | null;
  id: string;
  key: string;
  module: ProjectModule;
  owner_id: string;
  archived_at: Date | null;
  permissions: number;
  role_id: string;
  role_name: string;
}

const LOAD_TASK = `
  SELECT t.id AS task_id, t.number, t.parent_id, t.reporter_id, t.assignee_id,
         ct.name AS card_type_name, ct.edit_role_ids AS card_type_edit_roles,
         ct.view_role_ids <> '{}' AS card_type_restricted,
         p.id, p.key::text, p.module, p.owner_id, p.archived_at, r.permissions, r.id AS role_id, r.name AS role_name
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
  JOIN project_roles r ON r.id = m.role_id
  LEFT JOIN project_card_types ct ON ct.id = t.card_type_id
  WHERE t.id = $1
    AND (ct.id IS NULL OR ct.view_role_ids = '{}' OR m.role_id = ANY(ct.view_role_ids) OR p.owner_id = $2
         OR t.assignee_id = $2 OR t.reporter_id = $2)`;

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
      cardType: row.card_type_name
        ? {
            name: row.card_type_name,
            editRoleIds: row.card_type_edit_roles!,
            restricted: row.card_type_restricted!,
          }
        : null,
    } satisfies TaskContext,
  };
};

export const findTaskByIdentifier = async (identifier: string, userId: string) => {
  const parsed = parseIdentifier(identifier);
  const taskId = parsed && (await resolveIdentifier(parsed.key, parsed.number));
  const access = taskId && (await loadTaskAccess(taskId, userId));
  if (!access) throw notFound('Task not found');
  return access;
};

export const loadTask: RequestHandler = async (req, _res, next) => {
  const access = await loadTaskAccess(String(req.params.taskId), req.user!.id);
  if (!access) throw notFound('Task not found');
  req.project = access.project;
  req.task = access.task;
  next();
};

export const assertCardTypeEditable = (project: ProjectContext, task: Pick<TaskContext, 'cardType'>) => {
  if (task.cardType && !cardTypeAllows(task.cardType.editRoleIds, project.roleId, project.isOwner))
    throw forbidden(`Your role (${project.roleName}) can't edit ${task.cardType.name} cards`);
};

export const assertCanEditTask = (project: ProjectContext, task: TaskContext, userId: string) => {
  assertWritable(project);
  assertCardTypeEditable(project, task);
  if (!canEditTask(project.permissions, task, userId))
    throw forbidden(`Your role (${project.roleName}) can't edit this task`, {
      missing: [isOwnTask(task, userId) ? 'task.edit_own' : 'task.edit_any'],
    });
};

export const assertCanPatchTask = (
  project: ProjectContext,
  task: TaskContext,
  patch: UpdateTaskInput,
  userId: string,
) => {
  assertWritable(project);
  assertCardTypeEditable(project, task);
  const missing = missingTaskPermissions(project.permissions, task, patch, userId);
  if (missing.length) throw forbidden(`Your role (${project.roleName}) can't do that`, { missing });
};

export const assertCanAssignOnCreate = (
  project: ProjectContext,
  assigneeId: string | null | undefined,
  userId: string,
) => {
  if (!assigneeId) return;
  const missing = missingTaskPermissions(
    project.permissions,
    { reporterId: userId, assigneeId: null },
    { assigneeId },
    userId,
  );
  if (missing.length) throw forbidden(`Your role (${project.roleName}) can't assign this task`, { missing });
};
