import { z } from 'zod';
import type { StatusCategory } from '@msr/shared/enums';
import { HttpError } from '../../../lib/httpError';
import { emptyTask, type NormalizedTask } from '../../importer/types';
import { parsePriority, parseType, toIsoDate, toIsoTimestamp } from '../../importer/values';
import { sourceRequest } from '../http';
import type { MigrationAdapter } from '../types';

interface LinearPerson {
  name: string | null;
  email: string | null;
}

interface LinearIssue {
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  dueDate: string | null;
  createdAt: string;
  state: { name: string; type: string };
  assignee: LinearPerson | null;
  labels: { nodes: { name: string }[] };
  parent: { identifier: string } | null;
  comments?: { nodes: { body: string; createdAt: string; user: LinearPerson | null }[] };
}

const API = 'https://api.linear.app/graphql';
const LABEL = 'Linear';
const STATE_CATEGORY: Record<string, StatusCategory> = {
  triage: 'backlog',
  backlog: 'backlog',
  unstarted: 'todo',
  started: 'in_progress',
  completed: 'done',
  canceled: 'done',
};
const TEAMS = 'query { teams(first: 100) { nodes { id name key } } }';
const ISSUES = `
  query Issues($filter: IssueFilter!, $after: String, $comments: Boolean!) {
    issues(first: 50, after: $after, filter: $filter) {
      nodes {
        identifier title description priority dueDate createdAt
        state { name type }
        assignee { name email }
        labels { nodes { name } }
        parent { identifier }
        comments(first: 50) @include(if: $comments) { nodes { body createdAt user { name email } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
const TEAM_NAME = 'query Team($id: String!) { team(id: $id) { name } }';

const credentials = z.object({ apiKey: z.string().trim().min(10, 'Paste your Linear personal API key') });
type Credentials = z.infer<typeof credentials>;

const graphql = async <T>(apiKey: string, query: string, variables: Record<string, unknown> = {}) => {
  const body = await sourceRequest<{ data?: T; errors?: { message: string }[] }>(LABEL, API, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (body.errors?.length || !body.data)
    throw new HttpError(502, `Linear: ${body.errors?.[0]?.message ?? 'no data'}`);
  return body.data;
};

const toTask = (issue: LinearIssue): NormalizedTask => ({
  ...emptyTask(issue.title),
  externalId: issue.identifier,
  parentExternalId: issue.parent?.identifier ?? null,
  description: issue.description ?? '',
  type: parseType(issue.labels.nodes.map((label) => label.name).join(' ')),
  status: issue.state.name,
  statusCategory: STATE_CATEGORY[issue.state.type] ?? 'todo',
  priority: parsePriority(String(issue.priority)),
  assignee: issue.assignee,
  labels: issue.labels.nodes.map((label) => label.name).slice(0, 30),
  dueDate: toIsoDate(issue.dueDate),
  createdAt: toIsoTimestamp(issue.createdAt),
  comments: (issue.comments?.nodes ?? []).map((comment) => ({
    author: comment.user ?? { name: null, email: null },
    body: comment.body,
    createdAt: toIsoTimestamp(comment.createdAt),
  })),
});

export const linear: MigrationAdapter<Credentials> = {
  label: LABEL,
  credentials,
  listSources: async ({ apiKey }) => {
    const data = await graphql<{ teams: { nodes: { id: string; name: string; key: string }[] } }>(
      apiKey,
      TEAMS,
    );
    return data.teams.nodes.map((team) => ({ id: team.id, name: `${team.name} (${team.key})`, group: null }));
  },
  fetchSource: async ({ apiKey }, teamId, options, progress) => {
    const { team } = await graphql<{ team: { name: string } }>(apiKey, TEAM_NAME, { id: teamId });
    const filter = {
      team: { id: { eq: teamId } },
      ...(options.includeClosed ? {} : { state: { type: { nin: ['completed', 'canceled'] } } }),
    };
    const issues: LinearIssue[] = [];
    let after: string | null = null;
    do {
      const data: {
        issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
      } = await graphql(apiKey, ISSUES, { filter, after, comments: options.includeComments });
      issues.push(...data.issues.nodes);
      progress('Reading issues', issues.length, null);
      after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null;
    } while (after);
    return {
      name: team.name,
      tasks: issues.map(toTask),
      statusCategories: Object.fromEntries(
        issues.map((issue) => [issue.state.name, STATE_CATEGORY[issue.state.type] ?? 'todo']),
      ),
    };
  },
};
