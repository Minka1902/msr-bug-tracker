import type { Request, RequestHandler } from 'express';
import type { ProjectModule } from '@msr/shared/modules';
import { can, isSubsetOf, type Permission } from '@msr/shared/permissions';
import { prepared } from '../../db/pool';
import { conflict, forbidden, notFound } from '../../lib/httpError';

export interface ProjectContext {
  id: string;
  key: string;
  module: ProjectModule;
  ownerId: string;
  isOwner: boolean;
  isArchived: boolean;
  permissions: number;
  roleId: string;
  roleName: string;
}

interface AccessRow {
  id: string;
  key: string;
  module: ProjectModule;
  owner_id: string;
  archived_at: Date | null;
  permissions: number;
  role_id: string;
  role_name: string;
}

const LOAD_PROJECT = `
  SELECT p.id, p.key, p.module, p.owner_id, p.archived_at, r.permissions, r.id AS role_id, r.name AS role_name
  FROM projects p
  JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
  JOIN project_roles r ON r.id = m.role_id
  WHERE p.key = $1`;

export const toProjectContext = (row: AccessRow, userId: string): ProjectContext => ({
  id: row.id,
  key: row.key,
  module: row.module,
  ownerId: row.owner_id,
  isOwner: row.owner_id === userId,
  isArchived: row.archived_at !== null,
  permissions: row.permissions,
  roleId: row.role_id,
  roleName: row.role_name,
});

export const findProjectContext = async (key: string, userId: string) => {
  const [row] = await prepared<AccessRow>('load-project', LOAD_PROJECT, [key, userId]);
  if (!row) throw notFound('Project not found');
  return toProjectContext(row, userId);
};

export const loadProject: RequestHandler = async (req, _res, next) => {
  req.project = await findProjectContext(String(req.params.key ?? ''), req.user!.id);
  next();
};

export const projectOf = (req: Request) => req.project!;

export const assertWritable = (project: ProjectContext) => {
  if (project.isArchived) throw conflict('This project is archived. Restore it to make changes.');
};

export const assertCan = (project: ProjectContext, ...permissions: Permission[]) => {
  const missing = permissions.filter((permission) => !can(project.permissions, permission));
  if (missing.length) throw forbidden(`Your role (${project.roleName}) can't do that`, { missing });
};

export const assertCanWrite = (project: ProjectContext, ...permissions: Permission[]) => {
  assertCan(project, ...permissions);
  assertWritable(project);
};

export const assertCovers = (project: ProjectContext, ...masks: number[]) => {
  if (masks.some((mask) => !isSubsetOf(mask, project.permissions)))
    throw forbidden("You can't grant or change permissions you don't have yourself");
};

export const assertOwner = (project: ProjectContext) => {
  if (!project.isOwner) throw forbidden('Only the project owner can do that');
};
