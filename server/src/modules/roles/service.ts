import type { SystemRole } from '@msr/shared/permissions';
import type { ProjectRole } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { notFound } from '../../lib/httpError';

export interface RoleRow {
  id: string;
  name: string;
  system_key: SystemRole | null;
  permissions: number;
  member_count: number;
}

const ROLE_SELECT = `
  SELECT r.id, r.name, r.system_key, r.permissions,
         (SELECT count(*)::int FROM project_members m WHERE m.role_id = r.id) AS member_count
  FROM project_roles r`;

const LIST_ROLES = `${ROLE_SELECT} WHERE r.project_id = $1 ORDER BY r.position, r.created_at`;
const GET_ROLE = `${ROLE_SELECT} WHERE r.id = $1 AND r.project_id = $2`;
const INSERT_ROLE = `
  INSERT INTO project_roles (project_id, name, permissions, position)
  VALUES ($1, $2, $3, (SELECT COALESCE(max(position), 0) + 1 FROM project_roles WHERE project_id = $1))
  RETURNING id`;
const UPDATE_ROLE =
  'UPDATE project_roles SET name = COALESCE($3, name), permissions = COALESCE($4, permissions) WHERE id = $1 AND project_id = $2';
const REASSIGN_MEMBERS = 'UPDATE project_members SET role_id = $2 WHERE role_id = $1';
const DELETE_ROLE = 'DELETE FROM project_roles WHERE id = $1';

export const toRole = (row: RoleRow): ProjectRole => ({
  id: row.id,
  name: row.name,
  systemKey: row.system_key,
  permissions: row.permissions,
  memberCount: row.member_count,
});

export const listRoles = (projectId: string, db?: Db) =>
  query<RoleRow>(LIST_ROLES, [projectId], db).then((rows) => rows.map(toRole));

export const getRole = async (projectId: string, roleId: string, db?: Db) => {
  const role = await queryOne<RoleRow>(GET_ROLE, [roleId, projectId], db);
  if (!role) throw notFound('Role not found');
  return role;
};

export const createRole = async (projectId: string, name: string, permissions: number) => {
  const created = await queryOne<{ id: string }>(INSERT_ROLE, [projectId, name, permissions]);
  return toRole(await getRole(projectId, created!.id));
};

export const updateRole = async (
  projectId: string,
  roleId: string,
  input: { name?: string; permissions?: number },
) => {
  await query(UPDATE_ROLE, [roleId, projectId, input.name ?? null, input.permissions ?? null]);
  return toRole(await getRole(projectId, roleId));
};

export const deleteRole = (roleId: string, reassignToRoleId: string) =>
  transaction(async (db) => {
    await query(REASSIGN_MEMBERS, [roleId, reassignToRoleId], db);
    await query(DELETE_ROLE, [roleId], db);
  });
