import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import {
  workflowOf,
  type Priority,
  type StatusCategory,
  type TaskType,
  type Workflow,
} from '@msr/shared/enums';
import { describeEscalation } from '@msr/shared/escalation';
import { formatIdentifier } from '@msr/shared/identifiers';
import { missingTaskPermissions } from '@msr/shared/permissions';
import { describeRecurrence, nextAssignee, nextOccurrence } from '@msr/shared/recurrence';
import type { BulkPatch, CreateTaskInput, TaskFilters, UpdateTaskInput } from '@msr/shared/schemas/task';
import type { BoardColumn, EscalationRange, ProjectStatus, TaskRecurrence } from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { badRequest, forbidden, notFound } from '../../lib/httpError';
import { assertValidPosition, positionAfter } from '../../lib/position';
import { copyTextAttachments } from '../attachments/service';
import type { ProjectContext } from '../projects/access';
import { listStatuses } from '../statuses/service';
import { recordActivity, type ActivityInput } from './activity';
import { escalatePriorities } from './escalation';
import { buildTaskFilter, sortSql, type FilterContext } from './filters';
import {
  cardSelect,
  DETAIL_SELECT,
  TASK_FROM,
  toCard,
  toDetail,
  type CardRow,
  type DetailRow,
} from './queries';

interface CurrentRow {
  id: string;
  project_id: string;
  number: number;
  parent_id: string | null;
  type: TaskType;
  title: string;
  status_id: string;
  status_name: string;
  workflow: Workflow;
  category: StatusCategory;
  position: string;
  priority: Priority;
  severity: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  reporter_id: string | null;
  start_date: string | null;
  due_date: string | null;
  recurrence: TaskRecurrence | null;
  escalate_from: Priority | null;
  escalate_to: Priority | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  completed_at: Date | null;
  [column: string]: unknown;
}

const CATEGORY_FALLBACK: Record<StatusCategory, StatusCategory[]> = {
  backlog: ['backlog', 'todo', 'in_progress', 'done'],
  todo: ['todo', 'backlog', 'in_progress', 'done'],
  in_progress: ['in_progress', 'todo', 'backlog', 'done'],
  done: ['done'],
};

const SIMPLE_FIELDS = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  severity: 'severity',
  startDate: 'start_date',
  dueDate: 'due_date',
  isBlocked: 'is_blocked',
  blockedReason: 'blocked_reason',
  stepsToReproduce: 'steps_to_reproduce',
  expectedBehavior: 'expected_behavior',
  actualBehavior: 'actual_behavior',
  envOs: 'env_os',
  envBrowser: 'env_browser',
  envAppVersion: 'env_app_version',
  foundInVersion: 'found_in_version',
  fixVersion: 'fix_version',
  reproducibility: 'reproducibility',
} as const;

const SILENT_VALUE_FIELDS = new Set([
  'description',
  'stepsToReproduce',
  'expectedBehavior',
  'actualBehavior',
]);

const CURRENT_TASK = `
  SELECT t.*, s.name AS status_name, s.workflow, s.category, a.name AS assignee_name
  FROM tasks t JOIN project_statuses s ON s.id = t.status_id LEFT JOIN users a ON a.id = t.assignee_id
  WHERE t.id = ANY($1::uuid[]) AND t.project_id = $2
  ORDER BY t.number
  FOR UPDATE OF t`;
const NEXT_NUMBER = 'UPDATE projects SET task_seq = task_seq + 1 WHERE id = $1 RETURNING task_seq';
const LAST_IN_STATUS = 'SELECT max(position) AS position FROM tasks WHERE status_id = $1';
const NEXT_IN_STATUS = 'SELECT min(position) AS position FROM tasks WHERE status_id = $1 AND position > $2';
const MEMBER_IDS = 'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])';
const LABELS_IN_PROJECT = 'SELECT id, name FROM labels WHERE project_id = $1 AND id = ANY($2::uuid[])';
const PARENT = 'SELECT id, parent_id FROM tasks WHERE id = $1 AND project_id = $2';
const INSERT_TASK = `
  INSERT INTO tasks (project_id, number, parent_id, type, title, description, status_id, priority, severity, assignee_id, reporter_id,
                     start_date, due_date, completed_at, is_blocked, blocked_reason, position, steps_to_reproduce, expected_behavior,
                     actual_behavior, env_os, env_browser, env_app_version, found_in_version, fix_version, reproducibility, recurrence,
                     escalate_from, escalate_to, escalate_since)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CASE WHEN $14 THEN now() END, $15, $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30)
  RETURNING id`;
const INSERT_LABELS =
  'INSERT INTO task_labels (task_id, label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING';
const TASK_LABELS =
  'SELECT l.id, l.name FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = $1 ORDER BY lower(l.name)';
const CLEAR_LABELS = 'DELETE FROM task_labels WHERE task_id = $1';
const LINK_ATTACHMENTS = `
  WITH linked AS (
    UPDATE attachments SET task_id = $1 WHERE id = ANY($2::uuid[]) AND task_id IS NULL AND uploader_id = $3 RETURNING id
  )
  UPDATE tasks SET attachment_count = attachment_count + (SELECT count(*) FROM linked) WHERE id = $1`;
const REFRESH_PARENTS = `
  UPDATE tasks p SET subtask_total = c.total, subtask_done = c.done
  FROM (
    SELECT p2.id, count(c.id)::int AS total, count(c.id) FILTER (WHERE s.category = 'done')::int AS done
    FROM tasks p2 LEFT JOIN tasks c ON c.parent_id = p2.id LEFT JOIN project_statuses s ON s.id = c.status_id
    WHERE p2.id = ANY($1::uuid[]) GROUP BY p2.id
  ) c
  WHERE p.id = c.id`;
const FILE_KEYS =
  'SELECT storage_key FROM attachments WHERE task_id IN (SELECT id FROM tasks WHERE id = ANY($1::uuid[]) OR parent_id = ANY($1::uuid[]))';
const DELETE_TASKS = 'DELETE FROM tasks WHERE id = ANY($1::uuid[])';
const DUPLICATE_TASK = `
  INSERT INTO tasks (project_id, number, parent_id, type, title, description, status_id, priority, severity, assignee_id, reporter_id,
                     start_date, due_date, completed_at, is_blocked, blocked_reason, position, steps_to_reproduce, expected_behavior,
                     actual_behavior, env_os, env_browser, env_app_version, found_in_version, fix_version, reproducibility, checklist_total,
                     recurrence, escalate_from, escalate_to, escalate_since)
  SELECT project_id, $2, parent_id, type, left(title || ' (copy)', 300), description, status_id, priority, severity, assignee_id, $3,
         start_date, due_date, CASE WHEN completed_at IS NOT NULL THEN now() END, is_blocked, blocked_reason, $4, steps_to_reproduce,
         expected_behavior, actual_behavior, env_os, env_browser, env_app_version, found_in_version, fix_version, reproducibility, checklist_total,
         recurrence, escalate_from, escalate_to, escalate_since
  FROM tasks WHERE id = $1
  RETURNING id`;
const COPY_LABELS =
  'INSERT INTO task_labels (task_id, label_id) SELECT $2, label_id FROM task_labels WHERE task_id = $1';
const COPY_CHECKLIST = `
  INSERT INTO task_checklist_items (task_id, text, is_done, position)
  SELECT $2, text, false, position FROM task_checklist_items WHERE task_id = $1`;
const MOVE_ROW = `
  UPDATE tasks SET project_id = $2, number = $3, status_id = $4, position = $5, assignee_id = $6, parent_id = $7,
         completed_at = CASE WHEN $8 THEN COALESCE(completed_at, now()) END, updated_at = now()
  WHERE id = $1`;
const INSERT_ALIAS = 'INSERT INTO task_aliases (project_id, number, task_id) VALUES ($1, $2, $3)';
const MOVE_ACTIVITY = 'UPDATE task_activity SET project_id = $2 WHERE task_id = $1';
const TARGET_LABELS_BY_NAME = `
  SELECT tl.id FROM task_labels src JOIN labels sl ON sl.id = src.label_id JOIN labels tl ON lower(tl.name) = lower(sl.name) AND tl.project_id = $2
  WHERE src.task_id = $1`;
const RESOLVE_IDENTIFIER = `
  SELECT COALESCE(t.id, al.task_id) AS id
  FROM projects p
  LEFT JOIN tasks t ON t.project_id = p.id AND t.number = $2
  LEFT JOIN task_aliases al ON al.project_id = p.id AND al.number = $2
  WHERE p.key = $1`;
const SUBTASKS = `${cardSelect()} WHERE t.parent_id = $1 ORDER BY t.position, t.number`;
const RESERVE_NUMBERS = 'UPDATE projects SET task_seq = task_seq + $2 WHERE id = $1 RETURNING task_seq';
const ACTOR_TODAY = `SELECT (now() AT TIME ZONE coalesce(preferences->>'timezone', 'UTC'))::date::text AS today FROM users WHERE id = $1`;
const SPAWN_RECURRENCES = `
  INSERT INTO tasks (project_id, number, parent_id, type, title, description, status_id, priority, severity, assignee_id, reporter_id,
                     start_date, due_date, recurrence, position, steps_to_reproduce, expected_behavior, actual_behavior, env_os,
                     env_browser, env_app_version, found_in_version, fix_version, reproducibility, checklist_total, escalate_from,
                     escalate_to, escalate_since)
  SELECT t.project_id, x.number, t.parent_id, t.type, t.title, t.description, x.status_id, t.priority, t.severity, x.assignee_id,
         t.reporter_id, x.start_date, x.due_date, t.recurrence, x.position, t.steps_to_reproduce, t.expected_behavior,
         t.actual_behavior, t.env_os, t.env_browser, t.env_app_version, t.found_in_version, t.fix_version, t.reproducibility,
         t.checklist_total, t.escalate_from, t.escalate_to, CASE WHEN t.escalate_from IS NOT NULL THEN $8::date END
  FROM unnest($1::uuid[], $2::int[], $3::uuid[], $4::uuid[], $5::date[], $6::date[], $7::text[])
    AS x(source_id, number, status_id, assignee_id, start_date, due_date, position)
  JOIN tasks t ON t.id = x.source_id
  RETURNING id, number`;
const COPY_SPAWNED_LABELS = `
  INSERT INTO task_labels (task_id, label_id)
  SELECT x.id, tl.label_id FROM unnest($1::uuid[], $2::uuid[]) AS x(id, source_id) JOIN task_labels tl ON tl.task_id = x.source_id`;
const COPY_SPAWNED_CHECKLIST = `
  INSERT INTO task_checklist_items (task_id, text, is_done, position)
  SELECT x.id, c.text, false, c.position FROM unnest($1::uuid[], $2::uuid[]) AS x(id, source_id)
  JOIN task_checklist_items c ON c.task_id = x.source_id`;
const CLEAR_RECURRENCE = 'UPDATE tasks SET recurrence = NULL WHERE id = ANY($1::uuid[])';
const SET_PRIORITY = `
  UPDATE tasks SET priority = $2, escalate_from = NULL, escalate_to = NULL, escalate_since = NULL, updated_at = now()
  WHERE id = ANY($1::uuid[])`;

export const pickStatus = (statuses: ProjectStatus[], workflow: Workflow, category: StatusCategory) => {
  for (const candidate of CATEGORY_FALLBACK[category]) {
    const match = statuses.find((status) => status.workflow === workflow && status.category === candidate);
    if (match) return match;
  }
  throw badRequest(`The ${workflow} workflow has no usable status`);
};

const firstStatus = (statuses: ProjectStatus[], workflow: Workflow) =>
  statuses.find((status) => status.workflow === workflow)!;

const lastPosition = (db: Db, statusId: string) =>
  queryOne<{ position: string | null }>(LAST_IN_STATUS, [statusId], db).then((row) => row?.position ?? null);

const allocateNumber = (db: Db, projectId: string) =>
  queryOne<{ task_seq: number }>(NEXT_NUMBER, [projectId], db).then((row) => row!.task_seq);

const assertMembers = async (db: Db, projectId: string, userIds: (string | null | undefined)[]) => {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!ids.length) return;
  const found = await query<{ user_id: string }>(MEMBER_IDS, [projectId, ids], db);
  if (found.length !== ids.length) throw badRequest('Tasks can only be assigned to project members');
};

const projectLabels = async (db: Db, projectId: string, labelIds: string[]) => {
  const ids = [...new Set(labelIds)];
  if (!ids.length) return [];
  const labels = await query<{ id: string; name: string }>(LABELS_IN_PROJECT, [projectId, ids], db);
  if (labels.length !== ids.length) throw badRequest('Labels must belong to this project');
  return labels;
};

const refreshParents = (db: Db, parentIds: (string | null)[]) => {
  const ids = [...new Set(parentIds.filter((id): id is string => !!id))];
  return ids.length ? query(REFRESH_PARENTS, [ids], db) : Promise.resolve([]);
};

const actorToday = (db: Db, actorId: string) =>
  queryOne<{ today: string }>(ACTOR_TODAY, [actorId], db).then((row) => row!.today);

const scheduleOf = (row: Pick<CurrentRow, 'escalate_from' | 'escalate_to'>): EscalationRange | null =>
  row.escalate_from ? { from: row.escalate_from, to: row.escalate_to! } : null;

const lockTasks = (db: Db, projectId: string, ids: string[]) =>
  query<CurrentRow>(CURRENT_TASK, [ids, projectId], db);

const assertRecurrence = (db: Db, projectId: string, recurrence: TaskRecurrence | null | undefined) =>
  recurrence?.rotate.length ? assertMembers(db, projectId, recurrence.rotate) : Promise.resolve();

const shiftDate = (date: string | null, from: string | null, to: string) =>
  date && from
    ? new Date(Date.parse(to) - (Date.parse(from) - Date.parse(date))).toISOString().slice(0, 10)
    : null;

const spawnRecurrences = async (
  db: Db,
  project: ProjectContext,
  completed: Pick<
    CurrentRow,
    'id' | 'workflow' | 'assignee_id' | 'start_date' | 'due_date' | 'parent_id' | 'recurrence'
  >[],
  actorId: string,
) => {
  const sources = completed.filter((row) => row.recurrence);
  if (!sources.length) return;
  const today = await actorToday(db, actorId);
  const statuses = await listStatuses(project.id, db);
  const candidates = sources.map((row) => nextAssignee(row.recurrence!, row.assignee_id));
  const members = new Set(
    (
      await query<{ user_id: string }>(
        MEMBER_IDS,
        [project.id, [...new Set(candidates.filter((id): id is string => !!id))]],
        db,
      )
    ).map((row) => row.user_id),
  );
  const plans = sources.map((row, index) => {
    const dueDate = nextOccurrence(row.recurrence!, row.due_date, today);
    return {
      row,
      status: pickStatus(statuses, row.workflow, 'todo'),
      assigneeId: candidates[index] && members.has(candidates[index]) ? candidates[index] : null,
      dueDate,
      startDate: shiftDate(row.start_date, row.due_date, dueDate),
    };
  });
  const positions = new Map<string, string[]>();
  for (const statusId of new Set(plans.map((plan) => plan.status.id))) {
    const count = plans.filter((plan) => plan.status.id === statusId).length;
    positions.set(statusId, generateNKeysBetween(await lastPosition(db, statusId), null, count));
  }
  const last = (await queryOne<{ task_seq: number }>(RESERVE_NUMBERS, [project.id, plans.length], db))!
    .task_seq;
  const numbers = plans.map((_, index) => last - plans.length + 1 + index);
  const created = await query<{ id: string; number: number }>(
    SPAWN_RECURRENCES,
    [
      plans.map((plan) => plan.row.id),
      numbers,
      plans.map((plan) => plan.status.id),
      plans.map((plan) => plan.assigneeId),
      plans.map((plan) => plan.startDate),
      plans.map((plan) => plan.dueDate),
      plans.map((plan) => positions.get(plan.status.id)!.shift()!),
      today,
    ],
    db,
  );
  const sourceOf = new Map(numbers.map((number, index) => [number, plans[index]!.row.id]));
  const pairs = [created.map((row) => row.id), created.map((row) => sourceOf.get(row.number)!)];
  await query(COPY_SPAWNED_LABELS, pairs, db);
  await query(COPY_SPAWNED_CHECKLIST, pairs, db);
  await copyTextAttachments(db, pairs[0]!, pairs[1]!);
  await query(CLEAR_RECURRENCE, [pairs[1]], db);
  await escalatePriorities(pairs[0]!, false, db);
  await refreshParents(
    db,
    plans.map((plan) => plan.row.parent_id),
  );
  await recordActivity(
    created.map((row) => ({
      projectId: project.id,
      taskId: row.id,
      actorId,
      action: 'created',
      field: 'recurrence',
    })),
    db,
  );
};

export const getTaskDetail = async (taskId: string, db?: Db) => {
  const row = await queryOne<DetailRow>(`${DETAIL_SELECT} WHERE t.id = $1`, [taskId], db);
  if (!row) throw notFound('Task not found');
  return toDetail(row);
};

export const getCards = (ids: string[], db?: Db) =>
  query<CardRow>(`${cardSelect()} WHERE t.id = ANY($1::uuid[]) ORDER BY t.number`, [ids], db).then((rows) =>
    rows.map(toCard),
  );

export const listSubtasks = (taskId: string) =>
  query<CardRow>(SUBTASKS, [taskId]).then((rows) => rows.map(toCard));

export const listTasks = async (
  scopeSql: string,
  scopeValues: unknown[],
  filters: TaskFilters,
  context: FilterContext,
) => {
  const values = [...scopeValues];
  const conditions = [scopeSql, ...buildTaskFilter(filters, context, values)];
  const sql = `${cardSelect()} WHERE ${conditions.join(' AND ')} ORDER BY ${sortSql(filters)}
    LIMIT $${values.push(filters.limit + 1)} OFFSET $${values.push(filters.offset)}`;
  const rows = await query<CardRow>(sql, values);
  return { items: rows.slice(0, filters.limit).map(toCard), hasMore: rows.length > filters.limit };
};

export const getBoard = async (
  projectId: string,
  workflow: Workflow,
  filters: TaskFilters & { statusId?: string },
  context: FilterContext,
): Promise<BoardColumn[]> => {
  const values: unknown[] = [projectId, workflow];
  const conditions = ['t.project_id = $1', 's.workflow = $2', ...buildTaskFilter(filters, context, values)];
  if (filters.statusId) conditions.push(`t.status_id = $${values.push(filters.statusId)}`);
  const sql = `
    WITH ranked AS (
      SELECT t.id, row_number() OVER (PARTITION BY t.status_id ORDER BY t.position, t.id) AS rn,
             count(*) OVER (PARTITION BY t.status_id)::int AS column_total
      ${TASK_FROM}
      WHERE ${conditions.join(' AND ')}
    )
    ${cardSelect('rk.column_total')}
    JOIN ranked rk ON rk.id = t.id
    WHERE rk.rn > $${values.push(filters.offset)} AND rk.rn <= $${values.push(filters.offset + filters.limit)}
    ORDER BY s.position, t.position, t.id`;
  const [rows, statuses] = await Promise.all([
    query<CardRow & { column_total: number }>(sql, values),
    listStatuses(projectId),
  ]);
  return statuses
    .filter((status) => status.workflow === workflow && (!filters.statusId || status.id === filters.statusId))
    .map((status) => {
      const tasks = rows.filter((row) => row.status_id === status.id);
      return { statusId: status.id, total: tasks[0]?.column_total ?? 0, tasks: tasks.map(toCard) };
    });
};

export const resolveIdentifier = (key: string, number: number) =>
  queryOne<{ id: string | null }>(RESOLVE_IDENTIFIER, [key, number]).then((row) => row?.id ?? null);

export const createTask = (project: ProjectContext, input: CreateTaskInput, actorId: string) =>
  transaction(async (db) => {
    const type = input.type ?? 'task';
    const workflow = workflowOf(type);
    const statuses = await listStatuses(project.id, db);
    const status = input.statusId
      ? statuses.find((item) => item.id === input.statusId)
      : firstStatus(statuses, workflow);
    if (!status || status.workflow !== workflow)
      throw badRequest(`Choose a status from the ${workflow} workflow of this project`);
    if (input.parentId) {
      const parent = await queryOne<{ id: string; parent_id: string | null }>(
        PARENT,
        [input.parentId, project.id],
        db,
      );
      if (!parent) throw badRequest('The parent task must be in this project');
      if (parent.parent_id) throw badRequest('Subtasks cannot have their own subtasks');
    }
    await assertMembers(db, project.id, [input.assigneeId]);
    await assertRecurrence(db, project.id, input.recurrence);
    const labels = await projectLabels(db, project.id, input.labelIds ?? []);
    if (input.position) assertValidPosition(input.position);

    const number = await allocateNumber(db, project.id);
    const position = input.position ?? positionAfter(await lastPosition(db, status.id));
    const created = await queryOne<{ id: string }>(
      INSERT_TASK,
      [
        project.id,
        number,
        input.parentId ?? null,
        type,
        input.title,
        input.description ?? '',
        status.id,
        input.priority ?? 'medium',
        input.severity ?? null,
        input.assigneeId ?? null,
        actorId,
        input.startDate ?? null,
        input.dueDate ?? null,
        status.category === 'done',
        input.isBlocked ?? false,
        input.blockedReason ?? null,
        position,
        input.stepsToReproduce ?? '',
        input.expectedBehavior ?? '',
        input.actualBehavior ?? '',
        input.envOs ?? '',
        input.envBrowser ?? '',
        input.envAppVersion ?? '',
        input.foundInVersion ?? '',
        input.fixVersion ?? '',
        input.reproducibility ?? null,
        input.recurrence ?? null,
        input.escalation?.from ?? null,
        input.escalation?.to ?? null,
        input.escalation ? await actorToday(db, actorId) : null,
      ],
      db,
    );
    const taskId = created!.id;
    if (labels.length) await query(INSERT_LABELS, [taskId, labels.map((label) => label.id)], db);
    if (input.attachmentIds?.length)
      await query(LINK_ATTACHMENTS, [taskId, input.attachmentIds, actorId], db);
    await refreshParents(db, [input.parentId ?? null]);
    if (input.escalation) await escalatePriorities([taskId], false, db);
    await recordActivity([{ projectId: project.id, taskId, actorId, action: 'created' }], db);
    return getTaskDetail(taskId, db);
  });

export const updateTask = (
  project: ProjectContext,
  taskId: string,
  patch: UpdateTaskInput,
  actorId: string,
) =>
  transaction(async (db) => {
    const [current] = await lockTasks(db, project.id, [taskId]);
    if (!current) throw notFound('Task not found');
    const sets: Record<string, unknown> = {};
    const activity: ActivityInput[] = [];
    const log = (field: string, oldValue: unknown, newValue: unknown) =>
      activity.push({ projectId: project.id, taskId, actorId, action: 'updated', field, oldValue, newValue });

    const type = patch.type ?? current.type;
    const workflow = workflowOf(type);
    if (patch.type && patch.type !== current.type) {
      sets.type = patch.type;
      log('type', current.type, patch.type);
    }

    const statuses =
      patch.statusId || workflow !== current.workflow ? await listStatuses(project.id, db) : [];
    const targetStatus = patch.statusId
      ? statuses.find((status) => status.id === patch.statusId)
      : workflow !== current.workflow
        ? pickStatus(statuses, workflow, current.category)
        : undefined;
    if (patch.statusId && (!targetStatus || targetStatus.workflow !== workflow))
      throw badRequest(`Choose a status from the ${workflow} workflow of this project`);
    if (patch.position) assertValidPosition(patch.position);

    if (targetStatus && targetStatus.id !== current.status_id) {
      sets.status_id = targetStatus.id;
      sets.position = patch.position ?? positionAfter(await lastPosition(db, targetStatus.id));
      if ((targetStatus.category === 'done') !== (current.category === 'done'))
        sets.completed_at = targetStatus.category === 'done' ? new Date() : null;
      log('status', current.status_name, targetStatus.name);
    } else if (patch.position && patch.position !== current.position) {
      sets.position = patch.position;
    }

    if (patch.assigneeId !== undefined && patch.assigneeId !== current.assignee_id) {
      await assertMembers(db, project.id, [patch.assigneeId]);
      sets.assignee_id = patch.assigneeId;
      const next = patch.assigneeId
        ? (await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [patch.assigneeId], db))!
            .name
        : null;
      log('assignee', current.assignee_name, next);
    }

    for (const [field, column] of Object.entries(SIMPLE_FIELDS)) {
      const value = patch[field as keyof UpdateTaskInput];
      if (value === undefined || value === current[column]) continue;
      sets[column] = value;
      if (SILENT_VALUE_FIELDS.has(field)) log(field, null, null);
      else log(field, current[column] ?? null, value);
    }

    if (
      patch.recurrence !== undefined &&
      JSON.stringify(patch.recurrence) !== JSON.stringify(current.recurrence)
    ) {
      await assertRecurrence(db, project.id, patch.recurrence);
      sets.recurrence = patch.recurrence;
      log(
        'recurrence',
        current.recurrence && describeRecurrence(current.recurrence),
        patch.recurrence && describeRecurrence(patch.recurrence),
      );
    }

    const start = 'start_date' in sets ? (sets.start_date as string | null) : current.start_date;
    const due = 'due_date' in sets ? (sets.due_date as string | null) : current.due_date;
    if (start && due && start > due) throw badRequest('Start date must be on or before the due date');

    const scheduled = scheduleOf(current);
    const escalation =
      patch.escalation !== undefined
        ? patch.escalation
        : scheduled && ('priority' in sets || !due)
          ? null
          : scheduled;
    if (escalation && !due) throw badRequest('Set a due date to schedule the priority');
    if (describeEscalation(escalation) !== describeEscalation(scheduled)) {
      sets.escalate_from = escalation?.from ?? null;
      sets.escalate_to = escalation?.to ?? null;
      sets.escalate_since = escalation ? await actorToday(db, actorId) : null;
      log('escalation', describeEscalation(scheduled), describeEscalation(escalation));
    }

    if (patch.labelIds) {
      const before = await query<{ id: string; name: string }>(TASK_LABELS, [taskId], db);
      const next = await projectLabels(db, project.id, patch.labelIds);
      const changed =
        before
          .map((label) => label.id)
          .sort()
          .join() !==
        next
          .map((label) => label.id)
          .sort()
          .join();
      if (changed) {
        await query(CLEAR_LABELS, [taskId], db);
        if (next.length) await query(INSERT_LABELS, [taskId, next.map((label) => label.id)], db);
        log(
          'labels',
          before.map((label) => label.name),
          next.map((label) => label.name).sort(),
        );
        sets.updated_at = new Date();
      }
    }

    const columns = Object.keys(sets);
    if (columns.length) {
      const assignments = columns.map((column, index) => `${column} = $${index + 2}`);
      if (!columns.includes('updated_at')) assignments.push('updated_at = now()');
      await query(
        `UPDATE tasks SET ${assignments.join(', ')} WHERE id = $1`,
        [taskId, ...columns.map((column) => sets[column])],
        db,
      );
    }
    if ('completed_at' in sets) await refreshParents(db, [current.parent_id]);
    await recordActivity(activity, db);
    if (escalation) await escalatePriorities([taskId], true, db);
    if (sets.completed_at)
      await spawnRecurrences(
        db,
        project,
        [
          {
            ...current,
            recurrence:
              'recurrence' in sets ? (sets.recurrence as TaskRecurrence | null) : current.recurrence,
          },
        ],
        actorId,
      );
    return getTaskDetail(taskId, db);
  });

export const reopenTask = (project: ProjectContext, taskId: string, actorId: string) =>
  transaction(async (db) => {
    const [current] = await lockTasks(db, project.id, [taskId]);
    if (!current) throw notFound('Task not found');
    if (current.category !== 'done') throw badRequest('Only completed tasks can be reopened');
    return pickStatus(await listStatuses(project.id, db), current.workflow, 'todo').id;
  }).then((statusId) => updateTask(project, taskId, { statusId }, actorId));

export const deleteTasks = (project: ProjectContext, ids: string[], actorId: string) =>
  transaction(async (db) => {
    const rows = await lockTasks(db, project.id, ids);
    if (rows.length !== new Set(ids).size) throw notFound('Some tasks were not found');
    const files = await query<{ storage_key: string }>(FILE_KEYS, [ids], db);
    await query(DELETE_TASKS, [ids], db);
    await refreshParents(
      db,
      rows.map((row) => row.parent_id).filter((parentId) => parentId && !ids.includes(parentId)),
    );
    await recordActivity(
      rows.map((row) => ({
        projectId: project.id,
        taskId: null,
        actorId,
        action: 'deleted',
        newValue: { identifier: formatIdentifier(project.key, row.number), title: row.title },
      })),
      db,
    );
    return files.map((file) => file.storage_key);
  });

export const duplicateTask = (project: ProjectContext, taskId: string, actorId: string) =>
  transaction(async (db) => {
    const [original] = await lockTasks(db, project.id, [taskId]);
    if (!original) throw notFound('Task not found');
    const number = await allocateNumber(db, project.id);
    const next = await queryOne<{ position: string | null }>(
      NEXT_IN_STATUS,
      [original.status_id, original.position],
      db,
    );
    const created = await queryOne<{ id: string }>(
      DUPLICATE_TASK,
      [taskId, number, actorId, generateKeyBetween(original.position, next?.position ?? null)],
      db,
    );
    await query(COPY_LABELS, [taskId, created!.id], db);
    await query(COPY_CHECKLIST, [taskId, created!.id], db);
    await copyTextAttachments(db, [created!.id], [taskId]);
    await refreshParents(db, [original.parent_id]);
    await recordActivity(
      [
        {
          projectId: project.id,
          taskId: created!.id,
          actorId,
          action: 'created',
          field: 'duplicated_from',
          newValue: formatIdentifier(project.key, original.number),
        },
      ],
      db,
    );
    return getTaskDetail(created!.id, db);
  });

export const moveTask = (source: ProjectContext, target: ProjectContext, taskId: string, actorId: string) =>
  transaction(async (db) => {
    const [main] = await lockTasks(db, source.id, [taskId]);
    if (!main) throw notFound('Task not found');
    const children = await query<CurrentRow>(
      `SELECT t.*, s.workflow, s.category FROM tasks t JOIN project_statuses s ON s.id = t.status_id WHERE t.parent_id = $1 ORDER BY t.number FOR UPDATE OF t`,
      [taskId],
      db,
    );
    const statuses = await listStatuses(target.id, db);
    const lastByStatus = new Map<string, string | null>();
    const assigneeIds = [main, ...children].map((row) => row.assignee_id).filter(Boolean);
    const memberIds = new Set(
      (await query<{ user_id: string }>(MEMBER_IDS, [target.id, assigneeIds], db)).map((row) => row.user_id),
    );

    for (const row of [main, ...children]) {
      const status = pickStatus(statuses, row.workflow, row.category);
      if (!lastByStatus.has(status.id)) lastByStatus.set(status.id, await lastPosition(db, status.id));
      const position = positionAfter(lastByStatus.get(status.id));
      lastByStatus.set(status.id, position);
      const number = await allocateNumber(db, target.id);
      const labelIds = (await query<{ id: string }>(TARGET_LABELS_BY_NAME, [row.id, target.id], db)).map(
        (label) => label.id,
      );
      await query(
        MOVE_ROW,
        [
          row.id,
          target.id,
          number,
          status.id,
          position,
          row.assignee_id && memberIds.has(row.assignee_id) ? row.assignee_id : null,
          row.id === main.id ? null : main.id,
          status.category === 'done',
        ],
        db,
      );
      await query(INSERT_ALIAS, [source.id, row.number, row.id], db);
      await query(CLEAR_LABELS, [row.id], db);
      if (labelIds.length) await query(INSERT_LABELS, [row.id, labelIds], db);
      await query(MOVE_ACTIVITY, [row.id, target.id], db);
      await recordActivity(
        [
          {
            projectId: target.id,
            taskId: row.id,
            actorId,
            action: 'moved',
            oldValue: formatIdentifier(source.key, row.number),
            newValue: formatIdentifier(target.key, number),
          },
        ],
        db,
      );
    }
    await refreshParents(db, [main.parent_id, main.id]);
    return getTaskDetail(main.id, db);
  });

const bulkPermissionPatch = (patch: BulkPatch) => {
  const shape: Record<string, unknown> = {};
  if (patch.statusId || patch.statusCategory) shape.statusId = true;
  if (patch.priority) shape.priority = true;
  if (patch.severity !== undefined) shape.severity = true;
  if (patch.addLabelIds || patch.removeLabelIds) shape.labelIds = true;
  return shape;
};

export const bulkUpdateTasks = (project: ProjectContext, ids: string[], patch: BulkPatch, actorId: string) =>
  transaction(async (db) => {
    const uniqueIds = [...new Set(ids)];
    const rows = await lockTasks(db, project.id, uniqueIds);
    if (rows.length !== uniqueIds.length) throw notFound('Some tasks were not found in this project');

    const denied = rows.filter((row) => {
      const shape = {
        ...bulkPermissionPatch(patch),
        ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId }),
      };
      return (
        missingTaskPermissions(
          project.permissions,
          { reporterId: row.reporter_id, assigneeId: row.assignee_id },
          shape,
          actorId,
        ).length > 0
      );
    });
    if (denied.length)
      throw forbidden(`Your role (${project.roleName}) can't change some of these tasks`, {
        tasks: denied.map((row) => formatIdentifier(project.key, row.number)),
      });

    const activity: ActivityInput[] = [];
    const log = (taskId: string, field: string, oldValue: unknown, newValue: unknown) =>
      activity.push({ projectId: project.id, taskId, actorId, action: 'updated', field, oldValue, newValue });

    if (patch.statusId || patch.statusCategory) {
      const statuses = await listStatuses(project.id, db);
      const explicit = patch.statusId ? statuses.find((status) => status.id === patch.statusId) : null;
      if (patch.statusId && (!explicit || rows.some((row) => row.workflow !== explicit.workflow)))
        throw badRequest(
          'That status belongs to another workflow. Pick a category to update tasks and bugs together.',
        );
      const moves = rows
        .map((row) => ({
          row,
          status: explicit ?? pickStatus(statuses, row.workflow, patch.statusCategory!),
        }))
        .filter(({ row, status }) => status.id !== row.status_id);
      const byStatus = new Map<string, typeof moves>();
      moves.forEach((move) => byStatus.set(move.status.id, [...(byStatus.get(move.status.id) ?? []), move]));
      const positions: string[] = [];
      const ordered = [...byStatus.values()].flat();
      for (const [statusId, group] of byStatus)
        positions.push(...generateNKeysBetween(await lastPosition(db, statusId), null, group.length));
      if (ordered.length) {
        await query(
          `UPDATE tasks t SET status_id = x.status_id, position = x.position, updated_at = now(),
                  completed_at = CASE WHEN ns.category = 'done' THEN COALESCE(t.completed_at, now()) END
           FROM unnest($1::uuid[], $2::uuid[], $3::text[]) AS x(id, status_id, position)
           JOIN project_statuses ns ON ns.id = x.status_id
           WHERE t.id = x.id`,
          [ordered.map((move) => move.row.id), ordered.map((move) => move.status.id), positions],
          db,
        );
        ordered.forEach(({ row, status }) => log(row.id, 'status', row.status_name, status.name));
        await refreshParents(
          db,
          ordered.map((move) => move.row.parent_id),
        );
        await spawnRecurrences(
          db,
          project,
          ordered
            .filter(({ row, status }) => status.category === 'done' && row.category !== 'done')
            .map(({ row }) => row),
          actorId,
        );
      }
    }

    const scalar = async (
      column: string,
      field: string,
      value: unknown,
      display: (row: CurrentRow) => unknown,
      next: unknown,
    ) => {
      const changed = rows.filter((row) => row[column] !== value);
      if (!changed.length) return;
      await query(
        `UPDATE tasks SET ${column} = $2, updated_at = now() WHERE id = ANY($1::uuid[])`,
        [changed.map((row) => row.id), value],
        db,
      );
      changed.forEach((row) => log(row.id, field, display(row), next));
    };
    if (patch.priority) {
      const changed = rows.filter((row) => row.priority !== patch.priority);
      if (changed.length) {
        await query(SET_PRIORITY, [changed.map((row) => row.id), patch.priority], db);
        changed.forEach((row) => {
          log(row.id, 'priority', row.priority, patch.priority);
          if (row.escalate_from) log(row.id, 'escalation', describeEscalation(scheduleOf(row)), null);
        });
      }
    }
    if (patch.severity !== undefined)
      await scalar('severity', 'severity', patch.severity, (row) => row.severity, patch.severity);
    if (patch.assigneeId !== undefined) {
      await assertMembers(db, project.id, [patch.assigneeId]);
      const name = patch.assigneeId
        ? (await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [patch.assigneeId], db))!
            .name
        : null;
      await scalar('assignee_id', 'assignee', patch.assigneeId, (row) => row.assignee_name, name);
    }

    if (patch.addLabelIds?.length) {
      const labels = await projectLabels(db, project.id, patch.addLabelIds);
      const added = await query<{ task_id: string; label_id: string }>(
        `INSERT INTO task_labels (task_id, label_id) SELECT t, l FROM unnest($1::uuid[]) t CROSS JOIN unnest($2::uuid[]) l
         ON CONFLICT DO NOTHING RETURNING task_id, label_id`,
        [uniqueIds, labels.map((label) => label.id)],
        db,
      );
      added.forEach((row) =>
        log(row.task_id, 'labels', null, labels.find((label) => label.id === row.label_id)!.name),
      );
    }
    if (patch.removeLabelIds?.length) {
      const labels = await projectLabels(db, project.id, patch.removeLabelIds);
      const removed = await query<{ task_id: string; label_id: string }>(
        'DELETE FROM task_labels WHERE task_id = ANY($1::uuid[]) AND label_id = ANY($2::uuid[]) RETURNING task_id, label_id',
        [uniqueIds, labels.map((label) => label.id)],
        db,
      );
      removed.forEach((row) =>
        log(row.task_id, 'labels', labels.find((label) => label.id === row.label_id)!.name, null),
      );
    }
    if (patch.addLabelIds?.length || patch.removeLabelIds?.length)
      await query('UPDATE tasks SET updated_at = now() WHERE id = ANY($1::uuid[])', [uniqueIds], db);

    await recordActivity(activity, db);
    if (patch.statusId || patch.statusCategory) {
      const scheduledIds = rows.filter((row) => row.escalate_from).map((row) => row.id);
      if (scheduledIds.length) await escalatePriorities(scheduledIds, true, db);
    }
    return getCards(uniqueIds, db);
  });
