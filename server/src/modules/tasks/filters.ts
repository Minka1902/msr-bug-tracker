import type { TaskFilters, TaskSort } from '@msr/shared/schemas/task';
import { parseIdentifier } from '@msr/shared/identifiers';

export interface FilterContext {
  userId: string;
  timezone: string;
}

const SORT_SQL: Record<TaskSort, string> = {
  updated: 't.updated_at',
  created: 't.created_at',
  due: 't.due_date',
  priority: 't.priority',
  title: 'lower(t.title)',
  status: 's.category',
  number: 't.number',
  assignee: 'lower(a.name)',
  type: 't.type',
};

const toTsQuery = (text: string) => {
  const tokens = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return tokens.length
    ? tokens
        .map((token, index) => `${token.toLowerCase()}${index === tokens.length - 1 ? ':*' : ''}`)
        .join(' & ')
    : null;
};

export const sortSql = (filters: Pick<TaskFilters, 'sort' | 'dir'>) => {
  const direction = filters.dir === 'asc' ? 'ASC' : 'DESC';
  const extra = filters.sort === 'status' ? `, s.position ${direction}` : '';
  return `${SORT_SQL[filters.sort]} ${direction} NULLS LAST${extra}, t.number DESC`;
};

export const buildTaskFilter = (filters: TaskFilters, context: FilterContext, values: unknown[]) => {
  const param = (value: unknown) => `$${values.push(value)}`;
  const today = () => `(now() AT TIME ZONE ${param(context.timezone)})::date`;
  const conditions: string[] = [];

  if (filters.q) {
    const identifier = parseIdentifier(filters.q);
    const tsQuery = toTsQuery(filters.q);
    const textMatch = [
      tsQuery && `t.search_vector @@ to_tsquery('simple', ${param(tsQuery)})`,
      `t.title ILIKE ${param(`%${filters.q.replace(/[\\%_]/g, '\\$&')}%`)}`,
    ].filter(Boolean);
    conditions.push(
      identifier
        ? `((p.key = ${param(identifier.key)} AND t.number = ${param(identifier.number)}) OR ${textMatch.join(' OR ')})`
        : `(${textMatch.join(' OR ')})`,
    );
  }
  if (filters.status.length) conditions.push(`t.status_id = ANY(${param(filters.status)}::uuid[])`);
  if (filters.category.length)
    conditions.push(`s.category = ANY(${param(filters.category)}::status_category[])`);
  if (filters.type.length) conditions.push(`t.type = ANY(${param(filters.type)}::task_type[])`);
  if (filters.priority.length)
    conditions.push(`t.priority = ANY(${param(filters.priority)}::task_priority[])`);
  if (filters.severity.length)
    conditions.push(`t.severity = ANY(${param(filters.severity)}::bug_severity[])`);
  if (filters.assignee.length) {
    const ids = filters.assignee
      .filter((value) => value !== 'none')
      .map((value) => (value === 'me' ? context.userId : value));
    const parts = [
      ids.length && `t.assignee_id = ANY(${param(ids)}::uuid[])`,
      filters.assignee.includes('none') && 't.assignee_id IS NULL',
    ].filter(Boolean);
    conditions.push(`(${parts.join(' OR ')})`);
  }
  if (filters.label.length)
    conditions.push(
      `EXISTS (SELECT 1 FROM task_labels fl WHERE fl.task_id = t.id AND fl.label_id = ANY(${param(filters.label)}::uuid[]))`,
    );
  if (filters.project.length) conditions.push(`p.key = ANY(${param(filters.project)}::citext[])`);
  if (filters.dueFrom) conditions.push(`t.due_date >= ${param(filters.dueFrom)}::date`);
  if (filters.dueTo) conditions.push(`t.due_date <= ${param(filters.dueTo)}::date`);
  if (filters.createdFrom)
    conditions.push(
      `(t.created_at AT TIME ZONE ${param(context.timezone)})::date >= ${param(filters.createdFrom)}::date`,
    );
  if (filters.createdTo)
    conditions.push(
      `(t.created_at AT TIME ZONE ${param(context.timezone)})::date <= ${param(filters.createdTo)}::date`,
    );
  if (filters.overdue) conditions.push(`t.due_date < ${today()} AND s.category <> 'done'`);
  if (filters.blocked) conditions.push('t.is_blocked');
  if (filters.hideDone) conditions.push(`s.category <> 'done'`);
  if (filters.topLevel) conditions.push('t.parent_id IS NULL');

  return conditions;
};
