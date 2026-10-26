import { z } from 'zod';
import { badRequest } from '../../../lib/httpError';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { parsePriority, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { sourceRequest } from '../http';
import type { MigrationAdapter } from '../types';

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: ({ name: string } | string)[];
  assignee: { login: string } | null;
  milestone: { due_on: string | null } | null;
  created_at: string;
  pull_request?: unknown;
}

interface GitHubComment {
  issue_url: string;
  body: string;
  created_at: string;
  user: { login: string } | null;
}

const API = 'https://api.github.com';
const LABEL = 'GitHub';
const PAGE_SIZE = 100;
const MAX_REPO_PAGES = 5;
const REPO_NAME = /^[\w.-]+\/[\w.-]+$/;
const PRIORITY_LABEL = /(?:priority[:/ -]*)?\b(urgent|critical|high|medium|low|p[0-4])\b/i;
const OPEN = 'Open';
const CLOSED = 'Closed';

const credentials = z.object({ token: z.string().trim().min(10, 'Paste your GitHub personal access token') });
type Credentials = z.infer<typeof credentials>;

const get = <T>(token: string, path: string) =>
  sourceRequest<T>(LABEL, `${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

const getPages = async <T>(
  token: string,
  path: string,
  onPage?: (count: number) => void,
  maxPages = Infinity,
) => {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await get<T[]>(
      token,
      `${path}${path.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`,
    );
    items.push(...batch);
    onPage?.(items.length);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
};

const labelNames = (issue: GitHubIssue) =>
  issue.labels.map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean);

export const github: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async ({ token }) => {
    const repos = await getPages<{
      full_name: string;
      name: string;
      has_issues: boolean;
      owner: { login: string };
    }>(
      token,
      '/user/repos?sort=updated&affiliation=owner,collaborator,organization_member',
      undefined,
      MAX_REPO_PAGES,
    );
    return repos
      .filter((repo) => repo.has_issues)
      .map((repo) => ({ id: repo.full_name, name: repo.name, group: repo.owner.login }));
  },
  fetchSource: async ({ token }, repo, options, progress) => {
    if (!REPO_NAME.test(repo)) throw badRequest('Pick a repository from the list');
    const issues = (
      await getPages<GitHubIssue>(
        token,
        `/repos/${repo}/issues?state=${options.includeClosed ? 'all' : 'open'}&direction=asc`,
        (count) => progress('Reading issues', count, null),
      )
    ).filter((issue) => !issue.pull_request);
    const comments = new Map<number, NormalizedTask['comments']>();
    if (options.includeComments)
      (
        await getPages<GitHubComment>(token, `/repos/${repo}/issues/comments`, (count) =>
          progress('Reading comments', count, null),
        )
      ).forEach((comment) => {
        const number = Number(comment.issue_url.split('/').pop());
        const list = comments.get(number) ?? [];
        list.push({
          author: { email: null, name: comment.user?.login ?? null },
          body: comment.body,
          createdAt: toIsoTimestamp(comment.created_at),
        });
        comments.set(number, list);
      });
    const tasks = issues.map((issue): NormalizedTask => {
      const labels = labelNames(issue);
      return {
        ...emptyTask(issue.title),
        externalId: `#${issue.number}`,
        description: issue.body ?? '',
        type: parseType(labels.join(' ')),
        status: issue.state === 'open' ? OPEN : CLOSED,
        statusCategory: issue.state === 'open' ? 'todo' : 'done',
        priority: parsePriority(labels.map((label) => PRIORITY_LABEL.exec(label)?.[1]).find(Boolean)),
        assignee: issue.assignee ? { email: null, name: issue.assignee.login } : null,
        labels: labels.slice(0, 30),
        dueDate: toIsoDate(issue.milestone?.due_on),
        createdAt: toIsoTimestamp(issue.created_at),
        comments: comments.get(issue.number) ?? [],
      };
    });
    return { name: repo, tasks, statusCategories: { [OPEN]: 'todo', [CLOSED]: 'done' } };
  },
};
