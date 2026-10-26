import { z } from 'zod';
import type { StatusCategory } from '@msr/shared/enums';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { categoryFromName, parsePriority, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { adfToMarkdown } from '../adf';
import { sourceRequest } from '../http';
import type { MigrationAdapter } from '../types';

interface JiraUser {
  emailAddress?: string | null;
  displayName?: string | null;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;
    status: { name: string; statusCategory: { key: string } };
    priority: { name: string } | null;
    issuetype: { name: string };
    assignee: JiraUser | null;
    labels: string[];
    duedate: string | null;
    created: string;
    parent?: { key: string };
    comment?: { comments: { author: JiraUser; body: unknown; created: string }[] };
  };
}

const LABEL = 'Jira';
const JIRA_HOST = /^[a-z0-9-]+\.atlassian\.net$/;
const PAGE_SIZE = 100;
const FIELDS = [
  'summary',
  'description',
  'status',
  'priority',
  'issuetype',
  'assignee',
  'labels',
  'duedate',
  'created',
  'parent',
];
const CATEGORY: Record<string, StatusCategory> = { new: 'todo', indeterminate: 'in_progress', done: 'done' };

const toBaseUrl = (value: string) => {
  const host = value
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
  const full = host.includes('.') ? host : `${host}.atlassian.net`;
  return JIRA_HOST.test(full) ? `https://${full}` : '';
};

const credentials = z.object({
  site: z
    .string()
    .trim()
    .transform(toBaseUrl)
    .refine(Boolean, 'Use your Jira Cloud address, for example acme.atlassian.net'),
  email: z.string().trim().email('Enter the email you sign in to Jira with'),
  token: z.string().trim().min(10, 'Paste your Atlassian API token'),
});
type Credentials = z.infer<typeof credentials>;

const request = <T>({ site, email, token }: Credentials, path: string, body?: unknown) =>
  sourceRequest<T>(LABEL, `${site}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const categoryOf = (status: JiraIssue['fields']['status']): StatusCategory => {
  const category = CATEGORY[status.statusCategory.key] ?? 'todo';
  return category === 'todo' && categoryFromName(status.name) === 'backlog' ? 'backlog' : category;
};

const toTask = (issue: JiraIssue): NormalizedTask => {
  const { fields } = issue;
  const type = parseType(fields.issuetype.name);
  return {
    ...emptyTask(fields.summary),
    externalId: issue.key,
    parentExternalId: fields.parent?.key ?? null,
    description: adfToMarkdown(fields.description),
    type,
    status: fields.status.name,
    statusCategory: categoryOf(fields.status),
    priority: parsePriority(fields.priority?.name),
    assignee: fields.assignee
      ? { email: fields.assignee.emailAddress ?? null, name: fields.assignee.displayName ?? null }
      : null,
    labels: fields.labels.slice(0, 30),
    dueDate: toIsoDate(fields.duedate),
    createdAt: toIsoTimestamp(fields.created),
    comments: (fields.comment?.comments ?? []).map((comment) => ({
      author: { email: comment.author.emailAddress ?? null, name: comment.author.displayName ?? null },
      body: adfToMarkdown(comment.body),
      createdAt: toIsoTimestamp(comment.created),
    })),
  };
};

export const jira: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async (creds) => {
    const projects: { id: string; key: string; name: string }[] = [];
    for (let startAt = 0; ; startAt += 50) {
      const page = await request<{ values: typeof projects; isLast: boolean }>(
        creds,
        `/rest/api/3/project/search?maxResults=50&startAt=${startAt}`,
      );
      projects.push(...page.values);
      if (page.isLast || !page.values.length) break;
    }
    return projects.map((project) => ({
      id: project.id,
      name: `${project.name} (${project.key})`,
      group: null,
    }));
  },
  fetchSource: async (creds, projectId, options, progress) => {
    const project = await request<{ key: string; name: string }>(creds, `/rest/api/3/project/${projectId}`);
    const jql = `project = "${project.key}"${options.includeClosed ? '' : ' AND statusCategory != Done'} ORDER BY created ASC`;
    const fields = options.includeComments ? [...FIELDS, 'comment'] : FIELDS;
    const issues: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    do {
      const page = await request<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(
        creds,
        '/rest/api/3/search/jql',
        { jql, fields, maxResults: PAGE_SIZE, ...(nextPageToken ? { nextPageToken } : {}) },
      );
      issues.push(...page.issues);
      progress('Reading issues', issues.length, null);
      nextPageToken = page.isLast || !page.issues.length ? undefined : page.nextPageToken;
    } while (nextPageToken);
    return {
      name: project.name,
      tasks: issues.map(toTask),
      statusCategories: Object.fromEntries(
        issues.map((issue) => [issue.fields.status.name, categoryOf(issue.fields.status)]),
      ),
    };
  },
};
