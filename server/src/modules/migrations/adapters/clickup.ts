import { z } from 'zod';
import type { StatusCategory } from '@msr/shared/enums';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { categoryFromName, parsePriority, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { pacer, sourceRequest } from '../http';
import type { MigrationAdapter, SourceOption } from '../types';

interface ClickUpTask {
  id: string;
  name: string;
  markdown_description?: string | null;
  text_content?: string | null;
  status: { status: string; type: string };
  priority: { priority: string } | null;
  assignees: { username: string | null; email: string | null }[];
  tags: { name: string }[];
  due_date: string | null;
  start_date: string | null;
  date_created: string | null;
  parent: string | null;
  custom_item_id?: number | null;
  checklists?: { items: { name: string; resolved: boolean }[] }[];
}

interface ClickUpList {
  id: string;
  name: string;
}

const API = 'https://api.clickup.com/api/v2';
const LABEL = 'ClickUp';
const COMMENT_INTERVAL_MS = 650;
const PAGE_SIZE = 100;

const credentials = z.object({ token: z.string().trim().min(10, 'Paste your ClickUp API token') });
type Credentials = z.infer<typeof credentials>;

const get = <T>(token: string, path: string) =>
  sourceRequest<T>(LABEL, `${API}${path}`, { headers: { Authorization: token } });

const categoryOf = (status: ClickUpTask['status']): StatusCategory => {
  if (status.type === 'closed' || status.type === 'done') return 'done';
  const guessed = categoryFromName(status.status) ?? 'todo';
  if (status.type === 'open') return guessed === 'backlog' ? 'backlog' : 'todo';
  return guessed === 'todo' ? 'in_progress' : guessed;
};

const toTask = (task: ClickUpTask): NormalizedTask => ({
  ...emptyTask(task.name),
  externalId: task.id,
  parentExternalId: task.parent,
  description: task.markdown_description || task.text_content || '',
  type: parseType(task.tags.map((tag) => tag.name).join(' ')),
  status: task.status.status,
  statusCategory: categoryOf(task.status),
  priority: parsePriority(task.priority?.priority),
  assignee: task.assignees[0] ? { email: task.assignees[0].email, name: task.assignees[0].username } : null,
  labels: task.tags.map((tag) => tag.name).slice(0, 30),
  startDate: toIsoDate(task.start_date),
  dueDate: toIsoDate(task.due_date),
  createdAt: toIsoTimestamp(task.date_created),
  checklist: (task.checklists ?? []).flatMap((list) =>
    list.items.map((item) => ({ text: item.name, done: item.resolved })),
  ),
});

export const clickup: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async ({ token }) => {
    const { teams } = await get<{ teams: { id: string; name: string }[] }>(token, '/team');
    const sources: SourceOption[] = [];
    for (const team of teams) {
      const { spaces } = await get<{ spaces: { id: string; name: string }[] }>(
        token,
        `/team/${team.id}/space?archived=false`,
      );
      for (const space of spaces) {
        const [folders, folderless] = await Promise.all([
          get<{ folders: { name: string; lists: ClickUpList[] }[] }>(
            token,
            `/space/${space.id}/folder?archived=false`,
          ),
          get<{ lists: ClickUpList[] }>(token, `/space/${space.id}/list?archived=false`),
        ]);
        const group = `${team.name} / ${space.name}`;
        folderless.lists.forEach((list) => sources.push({ id: list.id, name: list.name, group }));
        folders.folders.forEach((folder) =>
          folder.lists.forEach((list) =>
            sources.push({ id: list.id, name: list.name, group: `${group} / ${folder.name}` }),
          ),
        );
      }
    }
    return sources;
  },
  fetchSource: async ({ token }, listId, options, progress) => {
    const list = await get<ClickUpList>(token, `/list/${listId}`);
    const raw: ClickUpTask[] = [];
    for (let page = 0; ; page += 1) {
      const { tasks, last_page } = await get<{ tasks: ClickUpTask[]; last_page?: boolean }>(
        token,
        `/list/${listId}/task?page=${page}&subtasks=true&include_markdown_description=true&include_closed=${options.includeClosed}`,
      );
      raw.push(...tasks);
      progress('Reading tasks', raw.length, null);
      if (last_page ?? tasks.length < PAGE_SIZE) break;
    }
    const tasks = raw.map(toTask);
    if (options.includeComments) {
      const wait = pacer(COMMENT_INTERVAL_MS);
      for (const [index, task] of tasks.entries()) {
        await wait();
        const { comments } = await get<{
          comments: {
            comment_text: string;
            date: string;
            user: { username: string | null; email: string | null };
          }[];
        }>(token, `/task/${task.externalId}/comment`);
        task.comments = comments.map((comment) => ({
          author: { email: comment.user.email, name: comment.user.username },
          body: comment.comment_text,
          createdAt: toIsoTimestamp(comment.date),
        }));
        progress('Reading comments', index + 1, tasks.length);
      }
    }
    return {
      name: list.name,
      tasks,
      statusCategories: Object.fromEntries(raw.map((task) => [task.status.status, categoryOf(task.status)])),
    };
  },
};
