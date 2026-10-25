import type { Severity, TaskType } from '@msr/shared/enums';
import { query, queryOne } from '../../db/pool';
import { getProjectSummary, listProjects } from '../projects/service';
import { ACTIVITY_SELECT, toActivity, type ActivityRow } from '../tasks/activity';
import { getCards } from '../tasks/service';

const TREND_DAYS = 14;
const LIST_SIZE = 8;

const scopedTasks = (projectFilter: string) => `
  scope AS (${projectFilter}),
  today AS (SELECT (now() AT TIME ZONE $2)::date AS d),
  t AS (
    SELECT t.id, t.type, t.priority, t.severity, t.due_date, t.created_at, t.updated_at, t.completed_at, t.status_id, s.category
    FROM tasks t JOIN project_statuses s ON s.id = t.status_id
    WHERE t.project_id IN (SELECT id FROM scope)
  )`;

const trend = (column: 'completed_at' | 'created_at') => `
  (SELECT json_agg(COALESCE(c.n, 0) ORDER BY g.day)
   FROM generate_series((SELECT d FROM today) - ${TREND_DAYS - 1}, (SELECT d FROM today), interval '1 day') AS g(day)
   LEFT JOIN (SELECT (${column} AT TIME ZONE $2)::date AS day, count(*)::int AS n FROM t WHERE ${column} IS NOT NULL GROUP BY 1) c
     ON c.day = g.day::date)`;

const HIGH_PRIORITY_BUGS = `
  (SELECT COALESCE(array_agg(id ORDER BY priority, severity NULLS LAST, due_date NULLS LAST), '{}') FROM (
     SELECT id, priority, severity, due_date FROM t
     WHERE type = 'bug' AND category <> 'done' AND (priority IN ('urgent', 'high') OR severity IN ('critical', 'major'))
     ORDER BY priority, severity NULLS LAST, due_date NULLS LAST LIMIT ${LIST_SIZE}) x)`;

const UPCOMING = `
  (SELECT COALESCE(array_agg(id ORDER BY due_date, priority), '{}') FROM (
     SELECT id, due_date, priority FROM t
     WHERE category <> 'done' AND due_date BETWEEN (SELECT d FROM today) AND (SELECT d FROM today) + 7
     ORDER BY due_date, priority LIMIT ${LIST_SIZE}) x)`;

const DASHBOARD = `
  WITH ${scopedTasks(`
    SELECT p.id FROM project_members m JOIN projects p ON p.id = m.project_id
    WHERE m.user_id = $1 AND p.archived_at IS NULL`)}
  SELECT
    (SELECT json_build_object(
       'total', count(*)::int,
       'completed', count(*) FILTER (WHERE category = 'done')::int,
       'incomplete', count(*) FILTER (WHERE category <> 'done')::int,
       'inProgress', count(*) FILTER (WHERE category = 'in_progress')::int,
       'overdue', count(*) FILTER (WHERE category <> 'done' AND due_date < (SELECT d FROM today))::int) FROM t) AS totals,
    ${trend('completed_at')} AS completed_trend,
    ${trend('created_at')} AS created_trend,
    (SELECT COALESCE(json_object_agg(severity, n), '{}') FROM (
       SELECT severity, count(*)::int AS n FROM t WHERE type = 'bug' AND category <> 'done' AND severity IS NOT NULL GROUP BY severity) x
    ) AS bugs_by_severity,
    (SELECT COALESCE(array_agg(id ORDER BY updated_at DESC), '{}') FROM (SELECT id, updated_at FROM t ORDER BY updated_at DESC LIMIT ${LIST_SIZE}) x) AS recent_ids,
    ${HIGH_PRIORITY_BUGS} AS bug_ids,
    ${UPCOMING} AS upcoming_ids`;

const DASHBOARD_ACTIVITY = `${ACTIVITY_SELECT}
  WHERE e.project_id IN (
    SELECT p.id FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.user_id = $1 AND p.archived_at IS NULL)
  ORDER BY e.id DESC LIMIT 15`;

const OVERVIEW = `
  WITH ${scopedTasks('SELECT $1::uuid AS id')}
  SELECT
    (SELECT COALESCE(json_agg(json_build_object('statusId', status_id, 'count', n)), '[]') FROM (SELECT status_id, count(*)::int AS n FROM t GROUP BY status_id) x) AS by_status,
    (SELECT COALESCE(json_object_agg(type, n), '{}') FROM (SELECT type, count(*)::int AS n FROM t GROUP BY type) x) AS by_type,
    (SELECT COALESCE(json_object_agg(priority, n), '{}') FROM (SELECT priority, count(*)::int AS n FROM t WHERE category <> 'done' GROUP BY priority) x) AS by_priority,
    ${trend('completed_at')} AS completed_trend,
    ${HIGH_PRIORITY_BUGS} AS bug_ids,
    ${UPCOMING} AS upcoming_ids`;

const PROJECT_ACTIVITY = `${ACTIVITY_SELECT} WHERE e.project_id = $1 AND ($2::bigint IS NULL OR e.id < $2) ORDER BY e.id DESC LIMIT $3`;

interface DashboardRow {
  totals: { total: number; completed: number; incomplete: number; inProgress: number; overdue: number };
  completed_trend: number[];
  created_trend: number[];
  bugs_by_severity: Partial<Record<Severity, number>>;
  recent_ids: string[];
  bug_ids: string[];
  upcoming_ids: string[];
}

interface OverviewRow {
  by_status: { statusId: string; count: number }[];
  by_type: Partial<Record<TaskType, number>>;
  by_priority: Record<string, number>;
  completed_trend: number[];
  bug_ids: string[];
  upcoming_ids: string[];
}

const cardsInOrder = async (groups: string[][]) => {
  const cards = await getCards([...new Set(groups.flat())]);
  const byId = new Map(cards.map((card) => [card.id, card]));
  return groups.map((ids) => ids.map((id) => byId.get(id)!).filter(Boolean));
};

export const getDashboard = async (userId: string, timezone: string) => {
  const [row, projects, activity] = await Promise.all([
    queryOne<DashboardRow>(DASHBOARD, [userId, timezone]),
    listProjects(userId, timezone, 'active'),
    query<ActivityRow>(DASHBOARD_ACTIVITY, [userId]),
  ]);
  const [recentTasks, highPriorityBugs, upcoming] = await cardsInOrder([
    row!.recent_ids,
    row!.bug_ids,
    row!.upcoming_ids,
  ]);
  return {
    totals: row!.totals,
    completedTrend: row!.completed_trend,
    createdTrend: row!.created_trend,
    bugsBySeverity: row!.bugs_by_severity,
    projects,
    recentTasks,
    highPriorityBugs,
    upcoming,
    activity: activity.map(toActivity),
  };
};

export const getProjectOverview = async (projectId: string, userId: string, timezone: string) => {
  const [row, summary, activity] = await Promise.all([
    queryOne<OverviewRow>(OVERVIEW, [projectId, timezone]),
    getProjectSummary(projectId, userId, timezone),
    query<ActivityRow>(PROJECT_ACTIVITY, [projectId, null, 10]),
  ]);
  const [highPriorityBugs, upcoming] = await cardsInOrder([row!.bug_ids, row!.upcoming_ids]);
  return {
    stats: summary.stats,
    byStatus: row!.by_status,
    byType: row!.by_type,
    byPriority: row!.by_priority,
    completedTrend: row!.completed_trend,
    highPriorityBugs,
    upcoming,
    activity: activity.map(toActivity),
  };
};

export const getProjectActivity = async (projectId: string, before: number | null, limit: number) => {
  const rows = await query<ActivityRow>(PROJECT_ACTIVITY, [projectId, before, limit + 1]);
  return { items: rows.slice(0, limit).map(toActivity), hasMore: rows.length > limit };
};
