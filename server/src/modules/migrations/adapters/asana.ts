import { z } from 'zod';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { categoryFromName, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { pacer, sourceRequest } from '../http';
import type { MigrationAdapter, SourceOption } from '../types';

interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  assignee: { name?: string; email?: string } | null;
  due_on: string | null;
  start_on: string | null;
  created_at: string;
  tags: { name: string }[];
  memberships: { project?: { gid: string }; section?: { name: string } }[];
  num_subtasks: number;
}

interface Page<T> {
  data: T[];
  next_page: { offset: string } | null;
}

const API = 'https://app.asana.com/api/1.0';
const LABEL = 'Asana';
const COMPLETED = 'Completed';
const TASK_FIELDS =
  'name,notes,completed,assignee.name,assignee.email,due_on,start_on,created_at,tags.name,memberships.project.gid,memberships.section.name,num_subtasks';
const REQUEST_INTERVAL_MS = 450;

const credentials = z.object({ token: z.string().trim().min(10, 'Paste your Asana personal access token') });
type Credentials = z.infer<typeof credentials>;

const get = <T>(token: string, path: string) =>
  sourceRequest<T>(LABEL, `${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

const getAll = async <T>(token: string, path: string) => {
  const items: T[] = [];
  let offset = '';
  do {
    const page = await get<Page<T>>(
      token,
      `${path}${path.includes('?') ? '&' : '?'}limit=100${offset ? `&offset=${offset}` : ''}`,
    );
    items.push(...page.data);
    offset = page.next_page?.offset ?? '';
  } while (offset);
  return items;
};

export const asana: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async ({ token }) => {
    const workspaces = await getAll<{ gid: string; name: string }>(token, '/workspaces');
    const sources: SourceOption[] = [];
    for (const workspace of workspaces) {
      const projects = await getAll<{ gid: string; name: string }>(
        token,
        `/projects?workspace=${workspace.gid}&archived=false&opt_fields=name`,
      );
      projects.forEach((project) =>
        sources.push({ id: project.gid, name: project.name, group: workspace.name }),
      );
    }
    return sources;
  },
  fetchSource: async ({ token }, projectId, options, progress) => {
    const { data: project } = await get<{ data: { name: string } }>(
      token,
      `/projects/${projectId}?opt_fields=name`,
    );
    const top = await getAll<AsanaTask>(
      token,
      `/projects/${projectId}/tasks?opt_fields=${TASK_FIELDS}${options.includeClosed ? '' : '&completed_since=now'}`,
    );
    progress('Reading tasks', top.length, null);
    const wait = pacer(REQUEST_INTERVAL_MS);
    const withParent: { task: AsanaTask; parent: string | null }[] = top.map((task) => ({
      task,
      parent: null,
    }));
    for (const task of top.filter((item) => item.num_subtasks > 0)) {
      await wait();
      const subtasks = await getAll<AsanaTask>(
        token,
        `/tasks/${task.gid}/subtasks?opt_fields=${TASK_FIELDS}`,
      );
      subtasks
        .filter((subtask) => options.includeClosed || !subtask.completed)
        .forEach((subtask) => withParent.push({ task: subtask, parent: task.gid }));
      progress('Reading subtasks', withParent.length, null);
    }
    const tasks = [] as NormalizedTask[];
    for (const [index, { task, parent }] of withParent.entries()) {
      const section = task.memberships.find((membership) => membership.project?.gid === projectId)?.section
        ?.name;
      const status = task.completed ? COMPLETED : (section ?? 'To do');
      const normalized: NormalizedTask = {
        ...emptyTask(task.name),
        externalId: task.gid,
        parentExternalId: parent,
        description: task.notes,
        type: parseType(task.tags.map((tag) => tag.name).join(' ')),
        status,
        statusCategory: task.completed ? 'done' : categoryFromName(status),
        assignee: task.assignee
          ? { email: task.assignee.email ?? null, name: task.assignee.name ?? null }
          : null,
        labels: task.tags.map((tag) => tag.name).slice(0, 30),
        startDate: toIsoDate(task.start_on),
        dueDate: toIsoDate(task.due_on),
        createdAt: toIsoTimestamp(task.created_at),
      };
      if (options.includeComments) {
        await wait();
        const stories = await getAll<{
          resource_subtype: string;
          text: string;
          created_at: string;
          created_by: { name?: string; email?: string } | null;
        }>(
          token,
          `/tasks/${task.gid}/stories?opt_fields=resource_subtype,text,created_at,created_by.name,created_by.email`,
        );
        normalized.comments = stories
          .filter((story) => story.resource_subtype === 'comment_added')
          .map((story) => ({
            author: { email: story.created_by?.email ?? null, name: story.created_by?.name ?? null },
            body: story.text,
            createdAt: toIsoTimestamp(story.created_at),
          }));
        progress('Reading comments', index + 1, withParent.length);
      }
      tasks.push(normalized);
    }
    return {
      name: project.name,
      tasks,
      statusCategories: Object.fromEntries(
        tasks.map((task) => [task.status!, task.statusCategory ?? 'todo']),
      ),
    };
  },
};
