import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IDENTIFIER_REGEX } from '@msr/shared/identifiers';
import type { ProjectSummary } from '@msr/shared/types';
import { z } from 'zod';
import { listItems } from '../../checklist/service';
import { listComments } from '../../comments/service';
import { findProjectContext } from '../../projects/access';
import { getProjectSummary, listProjects } from '../../projects/service';
import { search } from '../../search/service';
import { findTaskByIdentifier } from '../../tasks/access';
import { getTaskDetail, listSubtasks } from '../../tasks/service';
import { compactTask, projectUrl, taskUrl } from '../format';
import { loadRefs, statusNamesFor } from '../refs';
import { READ, run, type ToolContext } from '../tool';

const RECENT_COMMENTS = 20;

const compactProject = (project: ProjectSummary) => ({
  key: project.key,
  name: project.name,
  kind: project.kind,
  ...(project.description && { description: project.description }),
  role: project.roleName,
  ...(project.isArchived && { archived: true }),
  tasks: {
    total: project.stats.total,
    active: project.stats.active,
    overdue: project.stats.overdue,
    completed: project.stats.completed,
  },
  ...(project.nextDueDate && { nextDueDate: project.nextDueDate }),
  members: project.memberCount,
  url: projectUrl(project.key),
});

const fetchTask = async (identifier: string, { user }: ToolContext) => {
  const { task } = await findTaskByIdentifier(identifier, user.id);
  const [detail, checklist, comments, subtasks] = await Promise.all([
    getTaskDetail(task.id),
    listItems(task.id),
    listComments(task.id),
    listSubtasks(task.id),
  ]);
  const names = await statusNamesFor([detail.statusId, ...subtasks.map((subtask) => subtask.statusId)]);
  return {
    id: detail.identifier,
    title: detail.title,
    url: taskUrl(detail.identifier),
    text: detail.description,
    metadata: {
      ...compactTask(detail, names),
      reporter: detail.reporter?.name ?? null,
      ...(detail.blockedReason && { blockedReason: detail.blockedReason }),
      ...(detail.type === 'bug' && {
        stepsToReproduce: detail.stepsToReproduce,
        expectedResult: detail.expectedBehavior,
        actualResult: detail.actualBehavior,
      }),
      ...(checklist.length && {
        checklist: checklist.map((item) => ({ text: item.text, done: item.isDone })),
      }),
      ...(subtasks.length && { subtasks: subtasks.map((subtask) => compactTask(subtask, names)) }),
      ...(comments.length && {
        comments: comments.slice(-RECENT_COMMENTS).map((comment) => ({
          author: comment.author.name,
          at: comment.createdAt,
          body: comment.body,
        })),
      }),
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      completedAt: detail.completedAt,
    },
  };
};

const fetchProject = async (key: string, { user, timezone }: ToolContext) => {
  const context = await findProjectContext(key.toUpperCase(), user.id);
  const [summary, refs] = await Promise.all([
    getProjectSummary(context.id, user.id, timezone),
    loadRefs(context.id),
  ]);
  return {
    id: summary.key,
    title: summary.name,
    url: projectUrl(summary.key),
    text: summary.description,
    metadata: {
      ...compactProject(summary),
      statuses: refs.statuses.map(({ name, category, workflow }) => ({ name, category, workflow })),
      labels: refs.labels.map((label) => label.name),
      members: refs.members.map(({ name, email }) => ({ name, email })),
    },
  };
};

export const registerProjectTools = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'Lists the MSR projects you belong to (software projects and households) with task counts. Use a project key (like WEB) with the other tools.',
      inputSchema: { includeArchived: z.boolean().default(false).describe('Also list archived projects') },
      annotations: READ,
    },
    run(async ({ includeArchived }) => ({
      projects: (
        await listProjects(context.user.id, context.timezone, includeArchived ? 'all' : 'active')
      ).map(compactProject),
    })),
  );

  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Searches your projects and tasks by text or by task ID (like WEB-12). Returns ids you can pass to fetch.',
      inputSchema: { query: z.string().trim().min(1).max(200).describe('Words to look for, or a task ID') },
      annotations: READ,
    },
    run(async ({ query }) => {
      const found = await search(context.user.id, query);
      const names = await statusNamesFor(found.tasks.map((task) => task.statusId));
      return {
        results: [
          ...found.projects.map((project) => ({
            id: project.key,
            title: project.name,
            url: projectUrl(project.key),
            kind: 'project',
          })),
          ...found.tasks.map((task) => ({
            id: task.identifier,
            title: task.title,
            url: taskUrl(task.identifier),
            kind: 'task',
            status: names.get(task.statusId) ?? task.statusCategory,
          })),
        ],
      };
    }),
  );

  server.registerTool(
    'fetch',
    {
      title: 'Fetch a task or project',
      description:
        'Gets everything about one task (by ID like WEB-12: description, status, checklist, subtasks, recent comments) or one project (by key like WEB: statuses, labels and members you can use when creating or updating tasks).',
      inputSchema: {
        id: z.string().trim().min(2).max(20).describe('A task ID like WEB-12, or a project key like WEB'),
      },
      annotations: READ,
    },
    run(({ id }) => (IDENTIFIER_REGEX.test(id) ? fetchTask(id, context) : fetchProject(id, context))),
  );
};
