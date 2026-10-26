import { generateNKeysBetween } from 'fractional-indexing';
import {
  DEFAULT_STATUSES,
  HOUSEHOLD_LABELS,
  HOUSEHOLD_STATUSES,
  LABEL_COLORS,
  WORKFLOWS,
  type ProjectKind,
} from '@msr/shared/enums';
import {
  DEFAULT_ROLE_PERMISSIONS,
  HOUSEHOLD_ROLE_LABELS,
  HOUSEHOLD_ROLE_PERMISSIONS,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLES,
} from '@msr/shared/permissions';
import type { CreateProjectInput, UpdateProjectInput } from '@msr/shared/schemas/project';
import type { ProjectDetail, ProjectSummary } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { avatarUrl } from '../users/service';
import { listLabels } from '../labels/service';
import { listMembers } from '../members/service';
import { listRoles } from '../roles/service';
import { listStatuses } from '../statuses/service';

export type ArchivedFilter = 'active' | 'archived' | 'all';

interface SummaryRow {
  id: string;
  key: string;
  kind: ProjectKind;
  name: string;
  description: string;
  color: string;
  icon: string;
  live_url: string | null;
  repo_url: string | null;
  owner_id: string;
  archived_at: Date | null;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
  is_favorite: boolean;
  role_name: string;
  permissions: number;
  total: number;
  completed: number;
  active: number;
  overdue: number;
  next_due: string | null;
  last_task_update: Date | null;
  member_count: number;
  members: { id: string; name: string; avatar_key: string | null }[] | null;
}

const SUMMARY_SQL = `
  SELECT p.id, p.key, p.kind, p.name, p.description, p.color, p.icon, p.live_url, p.repo_url, p.owner_id, p.archived_at, p.is_demo, p.created_at, p.updated_at,
         my.is_favorite, r.name AS role_name, r.permissions,
         st.total, st.completed, st.active, st.overdue, st.next_due, st.last_task_update, mc.member_count, mem.members
  FROM project_members my
  JOIN projects p ON p.id = my.project_id
  JOIN project_roles r ON r.id = my.role_id
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE s.category = 'done')::int AS completed,
           count(*) FILTER (WHERE s.category = 'in_progress')::int AS active,
           count(*) FILTER (WHERE s.category <> 'done' AND t.due_date < (now() AT TIME ZONE $2)::date)::int AS overdue,
           min(t.due_date) FILTER (WHERE s.category <> 'done' AND t.due_date >= (now() AT TIME ZONE $2)::date) AS next_due,
           max(t.updated_at) AS last_task_update
    FROM tasks t JOIN project_statuses s ON s.id = t.status_id
    WHERE t.project_id = p.id
  ) st
  CROSS JOIN LATERAL (SELECT count(*)::int AS member_count FROM project_members WHERE project_id = p.id) mc
  CROSS JOIN LATERAL (
    SELECT json_agg(json_build_object('id', x.id, 'name', x.name, 'avatar_key', x.avatar_key) ORDER BY x.joined_at) AS members
    FROM (
      SELECT u.id, u.name, u.avatar_key, m.joined_at FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = p.id ORDER BY m.joined_at LIMIT 5
    ) x
  ) mem
  WHERE my.user_id = $1`;

const LIST_PROJECTS = `${SUMMARY_SQL}
  AND CASE $3::text WHEN 'active' THEN p.archived_at IS NULL WHEN 'archived' THEN p.archived_at IS NOT NULL ELSE true END
  ORDER BY my.is_favorite DESC, coalesce(my.last_opened_at, my.joined_at) DESC, p.name`;
const PROJECT_SUMMARY = `${SUMMARY_SQL} AND p.id = $3`;
const TOUCH_OPENED = `
  UPDATE project_members SET last_opened_at = now()
  WHERE project_id = $1 AND user_id = $2 AND (last_opened_at IS NULL OR last_opened_at < now() - interval '1 minute')`;
const INSERT_PROJECT = `
  INSERT INTO projects (key, kind, name, description, color, icon, live_url, repo_url, owner_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
const INSERT_ROLES = `
  INSERT INTO project_roles (project_id, name, system_key, permissions, position)
  SELECT $1, name, system_key::system_role, permissions, position
  FROM unnest($2::text[], $3::text[], $4::int[], $5::int[]) AS r(name, system_key, permissions, position)
  RETURNING id, system_key`;
const INSERT_MEMBER =
  'INSERT INTO project_members (project_id, user_id, role_id, last_opened_at) VALUES ($1, $2, $3, now())';
const INSERT_STATUSES = `
  INSERT INTO project_statuses (project_id, workflow, name, color, category, position)
  SELECT $1, workflow::workflow, name, color, category::status_category, position
  FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS s(workflow, name, color, category, position)`;
const INSERT_LABELS = `
  INSERT INTO labels (project_id, name, color) SELECT $1, name, color FROM unnest($2::text[], $3::text[]) AS l(name, color)`;
const INSERT_LIST = 'INSERT INTO shopping_lists (project_id, name, position) VALUES ($1, $2, $3)';
const UPDATE_PROJECT = `
  UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description), color = COALESCE($4, color),
         icon = COALESCE($5, icon), live_url = CASE WHEN $6 THEN $7 ELSE live_url END,
         repo_url = CASE WHEN $8 THEN $9 ELSE repo_url END, updated_at = now()
  WHERE id = $1`;
const SET_ARCHIVED =
  'UPDATE projects SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1';
const PROJECT_FILE_KEYS =
  'SELECT a.storage_key FROM attachments a JOIN tasks t ON t.id = a.task_id WHERE t.project_id = $1';
const DELETE_PROJECT = 'DELETE FROM projects WHERE id = $1';
const SET_FAVORITE = 'UPDATE project_members SET is_favorite = $3 WHERE project_id = $1 AND user_id = $2';
const TAKEN_KEYS = 'SELECT key::text FROM projects WHERE key = ANY($1::citext[])';

const KIND_SETUP = {
  software: {
    roleLabels: SYSTEM_ROLE_LABELS,
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    statuses: DEFAULT_STATUSES,
  },
  household: {
    roleLabels: HOUSEHOLD_ROLE_LABELS,
    rolePermissions: HOUSEHOLD_ROLE_PERMISSIONS,
    statuses: HOUSEHOLD_STATUSES,
  },
};
const FIRST_POSITION = 'a0';

const toSummary = (row: SummaryRow, userId: string): ProjectSummary => ({
  id: row.id,
  key: row.key,
  kind: row.kind,
  name: row.name,
  description: row.description,
  color: row.color,
  icon: row.icon,
  liveUrl: row.live_url,
  repoUrl: row.repo_url,
  isFavorite: row.is_favorite,
  isArchived: row.archived_at !== null,
  isDemo: row.is_demo,
  isOwner: row.owner_id === userId,
  roleName: row.role_name,
  permissions: row.permissions,
  stats: {
    total: row.total,
    completed: row.completed,
    active: row.active,
    overdue: row.overdue,
    progress: row.total ? Math.round((row.completed * 100) / row.total) : 0,
  },
  members: (row.members ?? []).map((member) => ({
    id: member.id,
    name: member.name,
    avatarUrl: avatarUrl(member.id, member.avatar_key),
  })),
  memberCount: row.member_count,
  nextDueDate: row.next_due,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  lastActivityAt: (row.last_task_update && row.last_task_update > row.updated_at
    ? row.last_task_update
    : row.updated_at
  ).toISOString(),
});

export const listProjects = (userId: string, timezone: string, archived: ArchivedFilter) =>
  query<SummaryRow>(LIST_PROJECTS, [userId, timezone, archived]).then((rows) =>
    rows.map((row) => toSummary(row, userId)),
  );

export const getProjectSummary = (projectId: string, userId: string, timezone: string, db?: Db) =>
  queryOne<SummaryRow>(PROJECT_SUMMARY, [userId, timezone, projectId], db).then((row) =>
    toSummary(row!, userId),
  );

export const getProjectDetail = async (
  projectId: string,
  userId: string,
  timezone: string,
): Promise<ProjectDetail> => {
  const [summary, statuses, labels, roles, memberList] = await Promise.all([
    getProjectSummary(projectId, userId, timezone),
    listStatuses(projectId),
    listLabels(projectId),
    listRoles(projectId),
    listMembers(projectId),
    query(TOUCH_OPENED, [projectId, userId]),
  ]);
  return { ...summary, statuses, labels, roles, memberList };
};

export const createProject = (input: CreateProjectInput, ownerId: string) =>
  transaction(async (db) => {
    const setup = KIND_SETUP[input.kind];
    const project = await queryOne<{ id: string }>(
      INSERT_PROJECT,
      [
        input.key,
        input.kind,
        input.name,
        input.description,
        input.color,
        input.icon,
        input.liveUrl ?? null,
        input.repoUrl ?? null,
        ownerId,
      ],
      db,
    );
    const roles = await query<{ id: string; system_key: string }>(
      INSERT_ROLES,
      [
        project!.id,
        SYSTEM_ROLES.map((role) => setup.roleLabels[role]),
        [...SYSTEM_ROLES],
        SYSTEM_ROLES.map((role) => setup.rolePermissions[role]),
        SYSTEM_ROLES.map((_, index) => index),
      ],
      db,
    );
    await query(
      INSERT_MEMBER,
      [project!.id, ownerId, roles.find((role) => role.system_key === 'owner')!.id],
      db,
    );
    const statuses = WORKFLOWS.flatMap((workflow) => {
      const positions = generateNKeysBetween(null, null, setup.statuses[workflow].length);
      return setup.statuses[workflow].map((status, index) => ({
        ...status,
        workflow,
        position: positions[index]!,
      }));
    });
    await query(
      INSERT_STATUSES,
      [
        project!.id,
        statuses.map((status) => status.workflow),
        statuses.map((status) => status.name),
        statuses.map((status) => status.color),
        statuses.map((status) => status.category),
        statuses.map((status) => status.position),
      ],
      db,
    );
    if (input.kind === 'household') {
      await query(
        INSERT_LABELS,
        [
          project!.id,
          HOUSEHOLD_LABELS,
          HOUSEHOLD_LABELS.map((_, index) => LABEL_COLORS[index % LABEL_COLORS.length]!),
        ],
        db,
      );
      await query(INSERT_LIST, [project!.id, 'Groceries', FIRST_POSITION], db);
    }
    return project!.id;
  });

export const updateProject = (projectId: string, input: UpdateProjectInput) =>
  query(UPDATE_PROJECT, [
    projectId,
    input.name ?? null,
    input.description ?? null,
    input.color ?? null,
    input.icon ?? null,
    input.liveUrl !== undefined,
    input.liveUrl ?? null,
    input.repoUrl !== undefined,
    input.repoUrl ?? null,
  ]);

export const setArchived = (projectId: string, archived: boolean) =>
  query(SET_ARCHIVED, [projectId, archived]);

export const deleteProject = (projectId: string) =>
  transaction(async (db) => {
    const files = await query<{ storage_key: string }>(PROJECT_FILE_KEYS, [projectId], db);
    await query(DELETE_PROJECT, [projectId], db);
    return files.map((file) => file.storage_key);
  });

export const setFavorite = (projectId: string, userId: string, favorite: boolean) =>
  query(SET_FAVORITE, [projectId, userId, favorite]);

export const keyAvailability = async (key: string) => {
  const candidates = [
    key,
    ...Array.from({ length: 98 }, (_, index) => `${key.slice(0, 6 - String(index + 2).length)}${index + 2}`),
  ];
  const taken = new Set(
    (await query<{ key: string }>(TAKEN_KEYS, [candidates])).map((row) => row.key.toUpperCase()),
  );
  return {
    key,
    available: !taken.has(key),
    suggestion: taken.has(key) ? (candidates.find((candidate) => !taken.has(candidate)) ?? null) : null,
  };
};
