import { randomUUID } from 'node:crypto';
import { generateNKeysBetween } from 'fractional-indexing';
import { LABEL_COLORS, workflowOf } from '@msr/shared/enums';
import { can } from '@msr/shared/permissions';
import type { ProjectStatus } from '@msr/shared/types';
import { bulkInsert } from '../../db/bulkInsert';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import type { ProjectContext } from '../projects/access';
import { listStatuses } from '../statuses/service';
import { pickStatus } from '../tasks/service';
import type { NormalizedTask, RowIssue, SourcePerson } from './types';
import { categoryFromName, personKey } from './values';

export interface ImportOptions {
  statusMap?: Record<string, string>;
  memberMap?: Record<string, string | null>;
  source?: string;
  rowNumbers?: number[];
}

export interface PreviewRow {
  row: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string | null;
  labels: string[];
  dueDate: string | null;
}

interface Member {
  id: string;
  name: string;
  email: string;
}

interface ResolvedTask {
  row: number;
  task: NormalizedTask;
  status: ProjectStatus;
  assigneeId: string | null;
  labels: string[];
  startDate: string | null;
  note: string;
}

const TITLE_MAX = 300;
const SAMPLE_SIZE = 20;

const MEMBERS = `
  SELECT u.id, u.name, u.email FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1`;
const LABELS = 'SELECT id, name FROM labels WHERE project_id = $1';
const RESERVE_NUMBERS = 'UPDATE projects SET task_seq = task_seq + $2 WHERE id = $1 RETURNING task_seq';
const LAST_POSITIONS = `
  SELECT status_id, max(position) AS position FROM tasks WHERE status_id = ANY($1::uuid[]) GROUP BY status_id`;
const REFRESH_COUNTERS = `
  UPDATE tasks t SET
    comment_count = (SELECT count(*) FROM task_comments c WHERE c.task_id = t.id),
    checklist_total = (SELECT count(*) FROM task_checklist_items i WHERE i.task_id = t.id),
    checklist_done = (SELECT count(*) FROM task_checklist_items i WHERE i.task_id = t.id AND i.is_done),
    subtask_total = (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id),
    subtask_done = (SELECT count(*) FROM tasks c JOIN project_statuses s ON s.id = c.status_id
                    WHERE c.parent_id = t.id AND s.category = 'done')
  WHERE t.id = ANY($1::uuid[])`;

const personLabel = (person: SourcePerson) => person.name ?? person.email ?? 'someone';

const countWarnings = (warnings: Map<string, number>) =>
  [...warnings].map(([message, count]) => (count > 1 ? `${message} (${count} tasks)` : message));

const resolve = async (
  project: ProjectContext,
  tasks: NormalizedTask[],
  actorId: string,
  options: ImportOptions,
  db?: Db,
) => {
  const [statuses, members, labels] = await Promise.all([
    listStatuses(project.id, db),
    query<Member>(MEMBERS, [project.id], db),
    query<{ id: string; name: string }>(LABELS, [project.id], db),
  ]);
  const warnings = new Map<string, number>();
  const warn = (message: string) => warnings.set(message, (warnings.get(message) ?? 0) + 1);
  const skipped: RowIssue[] = [];
  const membersByKey = new Map<string, Member>();
  members.forEach((member) => {
    membersByKey.set(member.email.toLowerCase(), member);
    membersByKey.set(`name:${member.name.toLowerCase()}`, member);
  });
  const labelsByName = new Map(labels.map((label) => [label.name.toLowerCase(), label]));
  const canAssignOthers = can(project.permissions, 'task.assign_others');
  const canAssignSelf = canAssignOthers || can(project.permissions, 'task.assign_self');
  const canCreateLabels = can(project.permissions, 'project.manage_labels');

  const statusFor = (task: NormalizedTask) => {
    const workflow = workflowOf(task.type);
    const name = task.status?.trim();
    const mappedId = name ? options.statusMap?.[name.toLowerCase()] : undefined;
    const mapped = mappedId && statuses.find((status) => status.id === mappedId);
    if (mapped)
      return mapped.workflow === workflow ? mapped : pickStatus(statuses, workflow, mapped.category);
    if (!name) return statuses.find((status) => status.workflow === workflow)!;
    const byName = statuses.find(
      (status) => status.workflow === workflow && status.name.toLowerCase() === name.toLowerCase(),
    );
    if (byName) return byName;
    const guessed = pickStatus(statuses, workflow, task.statusCategory ?? categoryFromName(name) ?? 'todo');
    if (!mappedId) warn(`Status "${name}" doesn't exist here, used "${guessed.name}"`);
    return guessed;
  };

  const assigneeFor = (task: NormalizedTask) => {
    if (!task.assignee) return { id: null, note: '' };
    const key = personKey(task.assignee);
    const mapped = options.memberMap && key in options.memberMap ? options.memberMap[key] : undefined;
    const member =
      mapped !== undefined
        ? members.find((item) => item.id === mapped)
        : (membersByKey.get(key) ??
          (task.assignee.name ? membersByKey.get(`name:${task.assignee.name.toLowerCase()}`) : undefined));
    const note = options.source
      ? `Originally assigned to ${personLabel(task.assignee)} in ${options.source}.`
      : '';
    if (!member) {
      if (mapped === undefined) warn(`${personLabel(task.assignee)} isn't a project member, left unassigned`);
      return { id: null, note };
    }
    if (member.id === actorId ? !canAssignSelf : !canAssignOthers) {
      warn("Your role can't assign tasks to others, so those tasks were left unassigned");
      return { id: null, note };
    }
    return { id: member.id, note: '' };
  };

  const resolved: ResolvedTask[] = [];
  tasks.forEach((task, index) => {
    const row = options.rowNumbers?.[index] ?? index + 1;
    const title = task.title.trim();
    if (!title) {
      skipped.push({ row, message: 'Title is missing' });
      return;
    }
    if (title.length > TITLE_MAX) warn(`Titles longer than ${TITLE_MAX} characters were shortened`);
    const startDate = task.startDate && task.dueDate && task.startDate > task.dueDate ? null : task.startDate;
    if (startDate !== task.startDate) warn('Start dates after the due date were dropped');
    const keptLabels = task.labels.filter((name) => {
      if (labelsByName.has(name.toLowerCase()) || canCreateLabels) return true;
      warn(`Label "${name}" doesn't exist and your role can't create labels, so it was skipped`);
      return false;
    });
    const assignee = assigneeFor(task);
    resolved.push({
      row,
      task: { ...task, title: title.slice(0, TITLE_MAX) },
      status: statusFor(task),
      assigneeId: assignee.id,
      labels: keptLabels,
      startDate,
      note: assignee.note,
    });
  });

  return { resolved, skipped, warnings, warn, members, labelsByName };
};

export const previewImport = async (
  project: ProjectContext,
  tasks: NormalizedTask[],
  actorId: string,
  options: ImportOptions,
) => {
  const { resolved, skipped, warnings, members } = await resolve(project, tasks, actorId, options);
  const sample: PreviewRow[] = resolved.slice(0, SAMPLE_SIZE).map((item) => ({
    row: item.row,
    title: item.task.title,
    type: item.task.type,
    status: item.status.name,
    priority: item.task.priority,
    assignee: members.find((member) => member.id === item.assigneeId)?.name ?? null,
    labels: item.labels,
    dueDate: item.task.dueDate,
  }));
  return { total: tasks.length, valid: resolved.length, skipped, warnings: countWarnings(warnings), sample };
};

export const commitImport = (
  project: ProjectContext,
  tasks: NormalizedTask[],
  actorId: string,
  options: ImportOptions,
) =>
  transaction(async (db) => {
    const { resolved, skipped, warnings, warn, members, labelsByName } = await resolve(
      project,
      tasks,
      actorId,
      options,
      db,
    );
    if (!resolved.length) return { created: 0, skipped, warnings: countWarnings(warnings) };

    const newLabels = [
      ...new Map(
        resolved
          .flatMap((item) => item.labels)
          .filter((name) => !labelsByName.has(name.toLowerCase()))
          .map((name) => [name.toLowerCase(), name.slice(0, 40)]),
      ).values(),
    ].map((name, index) => ({
      id: randomUUID(),
      project_id: project.id,
      name,
      color: LABEL_COLORS[index % LABEL_COLORS.length],
    }));
    await bulkInsert(
      db,
      'labels',
      [
        { name: 'id', type: 'uuid' },
        { name: 'project_id', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'color', type: 'text' },
      ],
      newLabels,
    );
    newLabels.forEach((label) => labelsByName.set(label.name.toLowerCase(), label));

    const lastNumber = (await queryOne<{ task_seq: number }>(
      RESERVE_NUMBERS,
      [project.id, resolved.length],
      db,
    ))!.task_seq;
    const ids = resolved.map(() => randomUUID());
    const idByExternal = new Map<string, number>();
    resolved.forEach((item, index) => item.task.externalId && idByExternal.set(item.task.externalId, index));
    const parentIndex = resolved.map((item, own) => {
      if (!item.task.parentExternalId) return null;
      let index = idByExternal.get(item.task.parentExternalId);
      if (index === undefined) {
        warn(`Parent "${item.task.parentExternalId}" isn't in this import, imported as a top-level task`);
        return null;
      }
      const seen = new Set<number>();
      while (resolved[index]!.task.parentExternalId && !seen.has(index)) {
        seen.add(index);
        const next = idByExternal.get(resolved[index]!.task.parentExternalId!);
        if (next === undefined) break;
        index = next;
      }
      return index === own ? null : index;
    });

    const usedStatuses = [...new Set(resolved.map((item) => item.status.id))];
    const lastPositions = new Map(
      (await query<{ status_id: string; position: string | null }>(LAST_POSITIONS, [usedStatuses], db)).map(
        (row) => [row.status_id, row.position],
      ),
    );
    const positions = new Map(
      usedStatuses.map((statusId) => [
        statusId,
        generateNKeysBetween(
          lastPositions.get(statusId) ?? null,
          null,
          resolved.filter((item) => item.status.id === statusId).length,
        ),
      ]),
    );
    const now = new Date();

    const taskRows = resolved.map((item, index) => {
      const createdAt = item.task.createdAt ? new Date(item.task.createdAt) : now;
      return {
        id: ids[index],
        project_id: project.id,
        number: lastNumber - resolved.length + index + 1,
        parent_id: parentIndex[index] === null ? null : ids[parentIndex[index]!],
        type: item.task.type,
        title: item.task.title,
        description: [item.task.description, item.note && `_${item.note}_`]
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 20000),
        status_id: item.status.id,
        priority: item.task.priority,
        severity: item.task.type === 'bug' ? item.task.severity : null,
        assignee_id: item.assigneeId,
        reporter_id: actorId,
        start_date: item.startDate,
        due_date: item.task.dueDate,
        completed_at: item.status.category === 'done' ? createdAt : null,
        position: positions.get(item.status.id)!.shift(),
        steps_to_reproduce: item.task.stepsToReproduce.slice(0, 20000),
        expected_behavior: item.task.expectedBehavior.slice(0, 20000),
        actual_behavior: item.task.actualBehavior.slice(0, 20000),
        created_at: createdAt,
        updated_at: now,
      };
    });
    await bulkInsert(
      db,
      'tasks',
      [
        { name: 'id', type: 'uuid' },
        { name: 'project_id', type: 'uuid' },
        { name: 'number', type: 'int' },
        { name: 'parent_id', type: 'uuid' },
        { name: 'type', type: 'text', cast: 'task_type' },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'status_id', type: 'uuid' },
        { name: 'priority', type: 'text', cast: 'task_priority' },
        { name: 'severity', type: 'text', cast: 'bug_severity' },
        { name: 'assignee_id', type: 'uuid' },
        { name: 'reporter_id', type: 'uuid' },
        { name: 'start_date', type: 'date' },
        { name: 'due_date', type: 'date' },
        { name: 'completed_at', type: 'timestamptz' },
        { name: 'position', type: 'text' },
        { name: 'steps_to_reproduce', type: 'text' },
        { name: 'expected_behavior', type: 'text' },
        { name: 'actual_behavior', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
        { name: 'updated_at', type: 'timestamptz' },
      ],
      [...taskRows.filter((row) => !row.parent_id), ...taskRows.filter((row) => row.parent_id)],
    );

    await bulkInsert(
      db,
      'task_labels',
      [
        { name: 'task_id', type: 'uuid' },
        { name: 'label_id', type: 'uuid' },
      ],
      resolved.flatMap((item, index) =>
        [...new Set(item.labels.map((name) => labelsByName.get(name.toLowerCase())!.id))].map((labelId) => ({
          task_id: ids[index],
          label_id: labelId,
        })),
      ),
    );
    await bulkInsert(
      db,
      'task_checklist_items',
      [
        { name: 'task_id', type: 'uuid' },
        { name: 'text', type: 'text' },
        { name: 'is_done', type: 'bool' },
        { name: 'position', type: 'text' },
      ],
      resolved.flatMap((item, index) => {
        const keys = generateNKeysBetween(null, null, item.task.checklist.length);
        return item.task.checklist.map((entry, position) => ({
          task_id: ids[index],
          text: entry.text.slice(0, 500),
          is_done: entry.done,
          position: keys[position],
        }));
      }),
    );
    const memberFor = (person: SourcePerson) =>
      members.find(
        (member) =>
          (person.email && member.email.toLowerCase() === person.email.toLowerCase()) ||
          (person.name && member.name.toLowerCase() === person.name.toLowerCase()),
      );
    await bulkInsert(
      db,
      'task_comments',
      [
        { name: 'task_id', type: 'uuid' },
        { name: 'author_id', type: 'uuid' },
        { name: 'body', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
      ],
      resolved.flatMap((item, index) =>
        item.task.comments
          .filter((comment) => comment.body.trim())
          .map((comment) => {
            const author = memberFor(comment.author);
            return {
              task_id: ids[index],
              author_id: author?.id ?? actorId,
              body: (author
                ? comment.body
                : `**${personLabel(comment.author)}** wrote:\n\n${comment.body}`
              ).slice(0, 20000),
              created_at: comment.createdAt ? new Date(comment.createdAt) : now,
            };
          }),
      ),
    );
    await bulkInsert(
      db,
      'task_activity',
      [
        { name: 'project_id', type: 'uuid' },
        { name: 'task_id', type: 'uuid' },
        { name: 'actor_id', type: 'uuid' },
        { name: 'action', type: 'text' },
      ],
      ids.map((id) => ({ project_id: project.id, task_id: id, actor_id: actorId, action: 'created' })),
    );
    await query(REFRESH_COUNTERS, [ids], db);
    if (newLabels.length) warn(`Created labels: ${newLabels.map((label) => label.name).join(', ')}`);
    return { created: resolved.length, skipped, warnings: countWarnings(warnings) };
  });
