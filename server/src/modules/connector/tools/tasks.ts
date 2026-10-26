import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PRIORITIES, SEVERITIES, TASK_TYPES } from '@msr/shared/enums';
import { createCommentSchema, createChecklistItemSchema } from '@msr/shared/schemas/collab';
import { createTaskSchema, TASK_SORTS, taskFilterSchema, updateTaskSchema } from '@msr/shared/schemas/task';
import { z } from 'zod';
import { createItem } from '../../checklist/service';
import { createComment } from '../../comments/service';
import { badRequest } from '../../../lib/httpError';
import { MY_TASKS_SCOPE } from '../../insights/service';
import { assertCanWrite, findProjectContext } from '../../projects/access';
import {
  assertCanAssignOnCreate,
  assertCanEditTask,
  assertCanPatchTask,
  findTaskByIdentifier,
} from '../../tasks/access';
import { createTask, getTaskDetail, listTasks, updateTask } from '../../tasks/service';
import { compactTask } from '../format';
import {
  loadRefs,
  resolveLabels,
  resolvePerson,
  resolveStatus,
  resolveStatusFilter,
  statusNamesFor,
  statusNamesOf,
} from '../refs';
import { READ, run, WRITE, type ToolContext } from '../tool';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const isoDate = z.iso.date().describe('YYYY-MM-DD');
const projectKey = z.string().trim().min(2).max(6).describe('Project key, like WEB');
const taskId = z.string().trim().min(3).max(20).describe('Task ID, like WEB-12');
const person = z.string().trim().max(254).describe('"me", a member\'s email, or their exact name');
const limit = z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT);

const csv = (values: string[] | undefined) => (values?.length ? values.join(',') : undefined);

export const registerTaskTools = (server: McpServer, context: ToolContext) => {
  const { user, timezone } = context;
  const filterContext = { userId: user.id, timezone };

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks in a project',
      description:
        'Lists tasks in one project, newest activity first unless you sort. Filters combine with AND. Completed tasks are hidden unless includeDone is true.',
      inputSchema: {
        projectKey,
        query: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe('Text in the title or description, or a task ID'),
        status: z
          .array(z.string())
          .max(20)
          .optional()
          .describe('Status names, or categories: backlog, todo, in_progress, done'),
        type: z.array(z.enum(TASK_TYPES)).optional(),
        priority: z.array(z.enum(PRIORITIES)).optional(),
        assignee: person.optional().describe('"me", "none", a member\'s email or exact name'),
        labels: z.array(z.string()).max(20).optional(),
        dueFrom: isoDate.optional(),
        dueTo: isoDate.optional(),
        overdue: z.boolean().optional(),
        includeDone: z.boolean().default(false),
        sort: z.enum(TASK_SORTS).default('updated'),
        direction: z.enum(['asc', 'desc']).default('desc'),
        limit,
      },
      annotations: READ,
    },
    run(async (input) => {
      const project = await findProjectContext(input.projectKey.toUpperCase(), user.id);
      const refs = await loadRefs(project.id);
      const status = input.status && resolveStatusFilter(refs, input.status);
      const assignee = input.assignee && (resolvePerson(refs, input.assignee, user.id) ?? 'none');
      const filters = taskFilterSchema.parse({
        q: input.query,
        status: csv(status?.ids),
        category: csv(status?.categories),
        type: csv(input.type),
        priority: csv(input.priority),
        assignee: assignee === user.id ? 'me' : assignee,
        label: csv(input.labels && resolveLabels(refs, input.labels)),
        dueFrom: input.dueFrom,
        dueTo: input.dueTo,
        overdue: input.overdue ? 'true' : undefined,
        hideDone: input.includeDone ? undefined : 'true',
        sort: input.sort,
        dir: input.direction,
        limit: input.limit,
      });
      const page = await listTasks('t.project_id = $1', [project.id], filters, filterContext);
      const names = statusNamesOf(refs);
      return { tasks: page.items.map((task) => compactTask(task, names)), hasMore: page.hasMore };
    }),
  );

  server.registerTool(
    'my_tasks',
    {
      title: 'My tasks',
      description: 'Lists open tasks assigned to you across all your projects, soonest due date first.',
      inputSchema: { includeDone: z.boolean().default(false), limit },
      annotations: READ,
    },
    run(async ({ includeDone, limit: size }) => {
      const filters = taskFilterSchema.parse({
        hideDone: includeDone ? undefined : 'true',
        sort: 'due',
        dir: 'asc',
        limit: size,
      });
      const page = await listTasks(MY_TASKS_SCOPE, [user.id], filters, filterContext);
      const names = await statusNamesFor(page.items.map((task) => task.statusId));
      return { tasks: page.items.map((task) => compactTask(task, names)), hasMore: page.hasMore };
    }),
  );

  if (!context.canWrite) return;

  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description:
        'Creates a task, bug, feature, chore or errand in a project. Status, labels and assignee are names; call fetch with the project key to see the valid ones.',
      inputSchema: {
        projectKey,
        title: z.string().trim().min(1).max(300),
        type: z.enum(TASK_TYPES).optional().describe('Defaults to task'),
        description: z.string().max(20000).optional().describe('Markdown'),
        status: z.string().optional().describe('Status name or category; defaults to the first to-do status'),
        priority: z.enum(PRIORITIES).optional(),
        severity: z.enum(SEVERITIES).optional().describe('Bugs only'),
        assignee: person.optional(),
        labels: z.array(z.string()).max(30).optional(),
        startDate: isoDate.optional(),
        dueDate: isoDate.optional(),
        parent: taskId.optional().describe('Make this a subtask of that task'),
        stepsToReproduce: z.string().max(20000).optional(),
        expectedResult: z.string().max(20000).optional(),
        actualResult: z.string().max(20000).optional(),
      },
      annotations: WRITE,
    },
    run(async (input) => {
      const project = await findProjectContext(input.projectKey.toUpperCase(), user.id);
      assertCanWrite(project, 'task.create');
      const refs = await loadRefs(project.id);
      const type = input.type ?? 'task';
      const parent = input.parent ? (await findTaskByIdentifier(input.parent, user.id)).task : null;
      if (parent && parent.projectId !== project.id)
        throw badRequest('The parent task must be in the same project');
      const task = createTaskSchema.parse({
        title: input.title,
        type,
        description: input.description,
        statusId: input.status && resolveStatus(refs, input.status, type),
        priority: input.priority,
        severity: type === 'bug' ? input.severity : undefined,
        assigneeId: input.assignee && resolvePerson(refs, input.assignee, user.id),
        labelIds: input.labels && resolveLabels(refs, input.labels),
        startDate: input.startDate,
        dueDate: input.dueDate,
        parentId: parent?.id,
        stepsToReproduce: input.stepsToReproduce,
        expectedBehavior: input.expectedResult,
        actualBehavior: input.actualResult,
      });
      assertCanAssignOnCreate(project, task.assigneeId, user.id);
      return { task: compactTask(await createTask(project, task, user.id), statusNamesOf(refs)) };
    }),
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update a task',
      description:
        'Changes a task: title, description, type, status, priority, severity, assignee, labels, dates or blocked state. Only the fields you pass change. Pass null to clear assignee, severity or a date.',
      inputSchema: {
        id: taskId,
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().max(20000).optional().describe('Markdown; replaces the whole description'),
        type: z.enum(TASK_TYPES).optional(),
        status: z.string().optional().describe('Status name or category (done, in_progress, todo, backlog)'),
        priority: z.enum(PRIORITIES).optional(),
        severity: z.enum(SEVERITIES).nullable().optional(),
        assignee: person.nullable().optional(),
        labels: z.array(z.string()).max(30).optional().describe('Replaces all labels'),
        addLabels: z.array(z.string()).max(30).optional(),
        removeLabels: z.array(z.string()).max(30).optional(),
        startDate: isoDate.nullable().optional(),
        dueDate: isoDate.nullable().optional(),
        blocked: z.boolean().optional(),
        blockedReason: z.string().trim().max(500).nullable().optional(),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    run(async (input) => {
      const { project, task } = await findTaskByIdentifier(input.id, user.id);
      const [refs, current] = await Promise.all([loadRefs(project.id), getTaskDetail(task.id)]);
      const type = input.type ?? current.type;
      const removed = new Set(resolveLabels(refs, input.removeLabels ?? []));
      const labels = input.labels
        ? resolveLabels(refs, input.labels)
        : input.addLabels || input.removeLabels
          ? [
              ...new Set([
                ...current.labels.map((label) => label.id),
                ...resolveLabels(refs, input.addLabels ?? []),
              ]),
            ].filter((id) => !removed.has(id))
          : undefined;
      const patch = updateTaskSchema.parse({
        title: input.title,
        description: input.description,
        type: input.type,
        statusId: input.status === undefined ? undefined : resolveStatus(refs, input.status, type),
        priority: input.priority,
        severity: input.severity,
        assigneeId: input.assignee === undefined ? undefined : resolvePerson(refs, input.assignee, user.id),
        labelIds: labels,
        startDate: input.startDate,
        dueDate: input.dueDate,
        isBlocked: input.blocked,
        blockedReason: input.blockedReason,
      });
      assertCanPatchTask(project, task, patch, user.id);
      return { task: compactTask(await updateTask(project, task.id, patch, user.id), statusNamesOf(refs)) };
    }),
  );

  server.registerTool(
    'add_comment',
    {
      title: 'Comment on a task',
      description: 'Adds a comment to a task. The comment is posted under your name.',
      inputSchema: { id: taskId, body: z.string().trim().min(1).max(20000).describe('Markdown') },
      annotations: WRITE,
    },
    run(async ({ id, body }) => {
      const { project, task } = await findTaskByIdentifier(id, user.id);
      assertCanWrite(project, 'comment.create');
      const comment = await createComment(task.id, user.id, createCommentSchema.parse({ body }));
      return { comment: { id: comment.id, task: id, at: comment.createdAt } };
    }),
  );

  server.registerTool(
    'add_checklist_items',
    {
      title: 'Add checklist items',
      description: "Adds items to the end of a task's checklist.",
      inputSchema: { id: taskId, items: z.array(z.string().trim().min(1).max(500)).min(1).max(20) },
      annotations: WRITE,
    },
    run(async ({ id, items }) => {
      const { project, task } = await findTaskByIdentifier(id, user.id);
      assertCanEditTask(project, task, user.id);
      const added = [];
      for (const text of items)
        added.push(await createItem(task.id, createChecklistItemSchema.parse({ text }).text));
      return { task: id, added: added.map((item) => item.text) };
    }),
  );
};
