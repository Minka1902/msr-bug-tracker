import type { ProjectMember } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { avatarUrl } from '../users/service';

interface MemberRow {
  id: string;
  name: string;
  avatar_key: string | null;
  email: string;
  role_id: string;
  role_name: string;
  role_permissions: number;
  is_owner: boolean;
  is_agent: boolean;
  joined_at: Date;
}

const MEMBER_SELECT = `
  SELECT u.id, u.name, u.avatar_key, u.email, r.id AS role_id, r.name AS role_name, r.permissions AS role_permissions,
         p.owner_id = u.id AS is_owner, u.agent_owner_id IS NOT NULL AS is_agent, m.joined_at
  FROM project_members m
  JOIN users u ON u.id = m.user_id
  JOIN project_roles r ON r.id = m.role_id
  JOIN projects p ON p.id = m.project_id`;

const LIST_MEMBERS = `${MEMBER_SELECT} WHERE m.project_id = $1 ORDER BY is_owner DESC, m.joined_at`;
const GET_MEMBER = `${MEMBER_SELECT} WHERE m.project_id = $1 AND m.user_id = $2`;
const INSERT_MEMBER = 'INSERT INTO project_members (project_id, user_id, role_id) VALUES ($1, $2, $3)';
const UPDATE_MEMBER_ROLE = 'UPDATE project_members SET role_id = $3 WHERE project_id = $1 AND user_id = $2';
const UNASSIGN_OPEN_TASKS = `
  WITH unassigned AS (
    UPDATE tasks SET assignee_id = NULL, updated_at = now()
    WHERE project_id = $1 AND assignee_id = $2 AND completed_at IS NULL
    RETURNING id
  )
  INSERT INTO task_activity (project_id, task_id, actor_id, action, field, old_value, new_value)
  SELECT $1, id, $3, 'updated', 'assignee', to_jsonb($4::text), 'null'::jsonb FROM unassigned`;
const DELETE_MEMBER = 'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2';

export type Member = MemberRow;

export const toMember = (row: MemberRow): ProjectMember => ({
  id: row.id,
  name: row.name,
  avatarUrl: avatarUrl(row.id, row.avatar_key),
  email: row.is_agent ? '' : row.email,
  roleId: row.role_id,
  roleName: row.role_name,
  isOwner: row.is_owner,
  isAgent: row.is_agent,
  joinedAt: row.joined_at.toISOString(),
});

export const listMembers = (projectId: string, db?: Db) =>
  query<MemberRow>(LIST_MEMBERS, [projectId], db).then((rows) => rows.map(toMember));

export const getMember = (projectId: string, userId: string, db?: Db) =>
  queryOne<MemberRow>(GET_MEMBER, [projectId, userId], db);

export const addMember = async (projectId: string, userId: string, roleId: string) => {
  await query(INSERT_MEMBER, [projectId, userId, roleId]);
  return toMember((await getMember(projectId, userId))!);
};

export const changeMemberRole = async (projectId: string, userId: string, roleId: string) => {
  await query(UPDATE_MEMBER_ROLE, [projectId, userId, roleId]);
  return toMember((await getMember(projectId, userId))!);
};

export const removeMember = (projectId: string, member: MemberRow, actorId: string) =>
  transaction(async (db) => {
    await query(UNASSIGN_OPEN_TASKS, [projectId, member.id, actorId, member.name], db);
    await query(DELETE_MEMBER, [projectId, member.id], db);
  });
