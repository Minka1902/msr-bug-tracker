import { STATUS_CATEGORIES, workflowOf, type StatusCategory, type TaskType } from '@msr/shared/enums';
import { query, queryOne } from '../../db/pool';
import { badRequest } from '../../lib/httpError';

const PROJECT_REFS = `
  SELECT
    (SELECT COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category, 'workflow', s.workflow)
       ORDER BY s.workflow, s.position), '[]') FROM project_statuses s WHERE s.project_id = $1) AS statuses,
    (SELECT COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name) ORDER BY l.name), '[]')
       FROM labels l WHERE l.project_id = $1) AS labels,
    (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email) ORDER BY u.name), '[]')
       FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1) AS members`;
const STATUS_NAMES = 'SELECT id, name FROM project_statuses WHERE id = ANY($1::uuid[])';

export interface ProjectRefs {
  statuses: { id: string; name: string; category: StatusCategory; workflow: 'task' | 'bug' }[];
  labels: { id: string; name: string }[];
  members: { id: string; name: string; email: string }[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const categoryOf = (value: string) =>
  STATUS_CATEGORIES.find((category) => same(category, value.replace(/[\s-]+/g, '_')));
const options = (names: string[]) => names.map((name) => `"${name}"`).join(', ');

export const loadRefs = async (projectId: string) =>
  (await queryOne<ProjectRefs>(PROJECT_REFS, [projectId]))!;

export const statusNamesFor = async (ids: string[]) =>
  new Map(
    (await query<{ id: string; name: string }>(STATUS_NAMES, [[...new Set(ids)]])).map((row) => [
      row.id,
      row.name,
    ]),
  );

export const statusNamesOf = (refs: ProjectRefs) =>
  new Map(refs.statuses.map((status) => [status.id, status.name]));

export const resolveStatus = (refs: ProjectRefs, value: string, type: TaskType) => {
  const workflow = workflowOf(type);
  const statuses = refs.statuses.filter((status) => status.workflow === workflow);
  const category = categoryOf(value);
  const match =
    statuses.find((status) => same(status.name, value)) ??
    (category && statuses.find((status) => status.category === category));
  if (!match)
    throw badRequest(`Unknown status "${value}". Use one of: ${options(statuses.map((s) => s.name))}`);
  return match.id;
};

export const resolveStatusFilter = (refs: ProjectRefs, values: string[]) => {
  const ids: string[] = [];
  const categories: StatusCategory[] = [];
  for (const value of values) {
    const byName = refs.statuses.filter((status) => same(status.name, value));
    const category = categoryOf(value);
    if (byName.length) ids.push(...byName.map((status) => status.id));
    else if (category) categories.push(category);
    else
      throw badRequest(
        `Unknown status "${value}". Use a status name (${options([...new Set(refs.statuses.map((s) => s.name))])}) or a category (${STATUS_CATEGORIES.join(', ')})`,
      );
  }
  return { ids, categories };
};

export const resolveLabels = (refs: ProjectRefs, names: string[]) =>
  names.map((name) => {
    const label = refs.labels.find((item) => same(item.name, name));
    if (!label)
      throw badRequest(`Unknown label "${name}". Use one of: ${options(refs.labels.map((l) => l.name))}`);
    return label.id;
  });

export const resolvePerson = (refs: ProjectRefs, value: string | null, userId: string) => {
  if (value === null || !value.trim() || same(value, 'none')) return null;
  if (same(value, 'me')) return userId;
  const matches = refs.members.filter((member) => same(member.email, value) || same(member.name, value));
  if (matches.length === 1) return matches[0]!.id;
  const people = refs.members.map((member) => `${member.name} <${member.email}>`);
  throw badRequest(
    matches.length
      ? `More than one member is called "${value}". Use their email: ${people.join(', ')}`
      : `"${value}" isn't a member of this project. Members: ${people.join(', ')}`,
  );
};
