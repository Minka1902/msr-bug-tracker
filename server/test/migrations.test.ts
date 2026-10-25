import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db/pool';
import { asana } from '../src/modules/migrations/adapters/asana';
import { clickup } from '../src/modules/migrations/adapters/clickup';
import { github } from '../src/modules/migrations/adapters/github';
import { jira } from '../src/modules/migrations/adapters/jira';
import { linear } from '../src/modules/migrations/adapters/linear';
import { trello } from '../src/modules/migrations/adapters/trello';
import { agentFor, registerUser, resetDb } from './helpers';

type Handler = unknown | ((url: string, init?: RequestInit) => unknown);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const mockApi = (routes: [RegExp, Handler][]) => {
  const mock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const match = routes.find(([pattern]) => pattern.test(url));
    if (!match) return json(404, { error: `no route for ${url}` });
    return json(
      200,
      typeof match[1] === 'function'
        ? (match[1] as (u: string, i?: RequestInit) => unknown)(url, init)
        : match[1],
    );
  });
  vi.stubGlobal('fetch', mock);
  return mock;
};

const noProgress = () => undefined;
const ALL = { includeComments: true, includeClosed: true };

beforeEach(resetDb);
afterEach(() => vi.unstubAllGlobals());

describe('migration adapters', () => {
  it('maps ClickUp lists, statuses, priorities, subtasks, checklists and comments', async () => {
    mockApi([
      [/\/team$/, { teams: [{ id: 't1', name: 'Acme' }] }],
      [/\/team\/t1\/space/, { spaces: [{ id: 's1', name: 'Product' }] }],
      [/\/space\/s1\/folder/, { folders: [{ name: 'Web', lists: [{ id: 'l2', name: 'Sprint 1' }] }] }],
      [/\/space\/s1\/list/, { lists: [{ id: 'l1', name: 'Backlog' }] }],
      [
        /\/list\/l1\/task/,
        {
          last_page: true,
          tasks: [
            {
              id: 'a',
              name: 'Fix login',
              markdown_description: 'Steps **here**',
              status: { status: 'in review', type: 'custom' },
              priority: { priority: 'normal' },
              assignees: [{ username: 'Dana', email: 'dana@acme.dev' }],
              tags: [{ name: 'bug' }],
              due_date: String(Date.UTC(2026, 10, 5)),
              start_date: null,
              date_created: String(Date.UTC(2026, 0, 2)),
              parent: null,
              checklists: [{ items: [{ name: 'Repro', resolved: true }] }],
            },
            {
              id: 'b',
              name: 'Write test',
              status: { status: 'complete', type: 'closed' },
              priority: null,
              assignees: [],
              tags: [],
              due_date: null,
              start_date: null,
              date_created: null,
              parent: 'a',
            },
          ],
        },
      ],
      [/\/list\/l1$/, { id: 'l1', name: 'Backlog' }],
      [
        /\/task\/a\/comment/,
        {
          comments: [
            {
              comment_text: 'Looks good',
              date: '1767225600000',
              user: { username: 'Sam', email: 'sam@acme.dev' },
            },
          ],
        },
      ],
      [/\/task\/b\/comment/, { comments: [] }],
    ]);
    expect(await clickup.listSources({ token: 'pk_123456789' })).toEqual([
      { id: 'l1', name: 'Backlog', group: 'Acme / Product' },
      { id: 'l2', name: 'Sprint 1', group: 'Acme / Product / Web' },
    ]);
    const source = await clickup.fetchSource({ token: 'pk_123456789' }, 'l1', ALL, noProgress);
    expect(source.statusCategories).toEqual({ 'in review': 'in_progress', complete: 'done' });
    expect(source.tasks[0]).toMatchObject({
      externalId: 'a',
      title: 'Fix login',
      type: 'bug',
      priority: 'medium',
      dueDate: '2026-11-05',
      assignee: { email: 'dana@acme.dev', name: 'Dana' },
      checklist: [{ text: 'Repro', done: true }],
      comments: [{ author: { email: 'sam@acme.dev', name: 'Sam' }, body: 'Looks good' }],
    });
    expect(source.tasks[1]).toMatchObject({ parentExternalId: 'a', statusCategory: 'done' });
  });

  it('reads Jira issues page by page and converts rich text', async () => {
    const fetchMock = mockApi([
      [/\/project\/10000$/, { key: 'APP', name: 'Mobile App' }],
      [
        /\/search\/jql/,
        (_url: string, init?: RequestInit) => {
          const body = JSON.parse(String(init!.body));
          const issue = (key: string, extra = {}) => ({
            key,
            fields: {
              summary: `Issue ${key}`,
              labels: ['ios'],
              duedate: '2026-12-01',
              created: '2026-01-01T10:00:00.000+0000',
              status: { name: 'Selected for Development', statusCategory: { key: 'new' } },
              priority: { name: 'Highest' },
              issuetype: { name: 'Bug' },
              assignee: { emailAddress: 'lee@acme.dev', displayName: 'Lee' },
              description: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Crash on ', marks: [] },
                      { type: 'text', text: 'launch', marks: [{ type: 'strong' }] },
                    ],
                  },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'iOS 26' }] }],
                      },
                    ],
                  },
                ],
              },
              comment: {
                comments: [
                  {
                    author: { displayName: 'Ana' },
                    body: {
                      type: 'doc',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same here' }] }],
                    },
                    created: '2026-01-02T10:00:00.000+0000',
                  },
                ],
              },
              ...extra,
            },
          });
          return body.nextPageToken
            ? { issues: [issue('APP-2', { parent: { key: 'APP-1' } })], isLast: true }
            : { issues: [issue('APP-1')], nextPageToken: 'next', isLast: false };
        },
      ],
    ]);
    const creds = jira.credentials.parse({
      site: 'https://acme.atlassian.net/jira/software',
      email: 'me@acme.dev',
      token: 'atlassian-token',
    });
    expect(creds.site).toBe('https://acme.atlassian.net');
    expect(() =>
      jira.credentials.parse({ site: 'evil.example.com', email: 'me@acme.dev', token: 'atlassian-token' }),
    ).toThrow();
    const source = await jira.fetchSource(
      creds,
      '10000',
      { includeComments: true, includeClosed: false },
      noProgress,
    );
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('search/jql'))!;
    expect(JSON.parse(String(init!.body)).jql).toBe(
      'project = "APP" AND statusCategory != Done ORDER BY created ASC',
    );
    expect(source.tasks).toHaveLength(2);
    expect(source.tasks[0]).toMatchObject({
      type: 'bug',
      priority: 'urgent',
      statusCategory: 'todo',
      description: 'Crash on **launch**\n\n- iOS 26',
      comments: [{ author: { name: 'Ana', email: null }, body: 'Same here' }],
    });
    expect(source.tasks[1]!.parentExternalId).toBe('APP-1');
  });

  it('maps Trello lists, archived cards, members and comment actions', async () => {
    mockApi([
      [/\/boards\/b1\?fields=name/, { name: 'Roadmap' }],
      [
        /\/boards\/b1\/lists/,
        [
          { id: 'L1', name: 'Doing' },
          { id: 'L2', name: 'Done' },
        ],
      ],
      [/\/boards\/b1\/members/, [{ id: 'M1', fullName: 'Rita Ray', username: 'rita' }]],
      [
        /\/boards\/b1\/cards\/all/,
        [
          {
            id: '65a1f0000000000000000001',
            name: 'Plan launch',
            desc: 'Notes',
            idList: 'L1',
            idMembers: ['M1'],
            labels: [{ name: 'Feature', color: 'green' }],
            due: '2026-11-11T12:00:00.000Z',
            start: null,
            closed: false,
            checklists: [
              {
                checkItems: [
                  { name: 'B', state: 'incomplete', pos: 2 },
                  { name: 'A', state: 'complete', pos: 1 },
                ],
              },
            ],
          },
          {
            id: '65a1f0000000000000000002',
            name: 'Old card',
            desc: '',
            idList: 'L1',
            idMembers: [],
            labels: [],
            due: null,
            start: null,
            closed: true,
          },
        ],
      ],
      [
        /\/boards\/b1\/actions/,
        [
          {
            date: '2026-02-01T00:00:00.000Z',
            data: { text: 'On it', card: { id: '65a1f0000000000000000001' } },
            memberCreator: { fullName: 'Rita Ray' },
          },
        ],
      ],
    ]);
    const source = await trello.fetchSource(
      { key: 'trello-key-123', token: 'trello-token-123' },
      'b1',
      ALL,
      noProgress,
    );
    expect(source.tasks[0]).toMatchObject({
      status: 'Doing',
      statusCategory: 'in_progress',
      type: 'feature',
      assignee: { name: 'Rita Ray', email: null },
      checklist: [
        { text: 'A', done: true },
        { text: 'B', done: false },
      ],
      comments: [{ body: 'On it' }],
      createdAt: new Date(0x65a1f000 * 1000).toISOString(),
    });
    expect(source.tasks[1]!.statusCategory).toBe('done');
  });

  it('reads Asana sections, subtasks and comment stories', async () => {
    mockApi([
      [/\/projects\/p1\?opt_fields=name/, { data: { name: 'Website' } }],
      [
        /\/projects\/p1\/tasks/,
        {
          data: [
            {
              gid: '1',
              name: 'Homepage',
              notes: 'Hero',
              completed: false,
              assignee: { name: 'Kim', email: 'kim@acme.dev' },
              due_on: '2026-11-01',
              start_on: null,
              created_at: '2026-01-01T00:00:00Z',
              tags: [],
              memberships: [{ project: { gid: 'p1' }, section: { name: 'In progress' } }],
              num_subtasks: 1,
            },
          ],
          next_page: null,
        },
      ],
      [
        /\/tasks\/1\/subtasks/,
        {
          data: [
            {
              gid: '2',
              name: 'Copy',
              notes: '',
              completed: true,
              assignee: null,
              due_on: null,
              start_on: null,
              created_at: '2026-01-02T00:00:00Z',
              tags: [],
              memberships: [],
              num_subtasks: 0,
            },
          ],
          next_page: null,
        },
      ],
      [
        /\/tasks\/\d\/stories/,
        {
          data: [
            {
              resource_subtype: 'comment_added',
              text: 'Ship it',
              created_at: '2026-01-03T00:00:00Z',
              created_by: { name: 'Kim' },
            },
            { resource_subtype: 'assigned', text: 'x', created_at: '2026-01-03T00:00:00Z', created_by: null },
          ],
          next_page: null,
        },
      ],
    ]);
    const source = await asana.fetchSource({ token: 'asana-pat-123' }, 'p1', ALL, noProgress);
    expect(source.tasks.map((task) => [task.title, task.status, task.parentExternalId])).toEqual([
      ['Homepage', 'In progress', null],
      ['Copy', 'Completed', '1'],
    ]);
    expect(source.tasks[0]!.comments).toEqual([
      { author: { name: 'Kim', email: null }, body: 'Ship it', createdAt: '2026-01-03T00:00:00.000Z' },
    ]);
  });

  it('pages through Linear issues with a team filter', async () => {
    const fetchMock = mockApi([
      [
        /linear\.app/,
        (_url: string, init?: RequestInit) => {
          const body = JSON.parse(String(init!.body));
          if (body.query.includes('team(id')) return { data: { team: { name: 'Core' } } };
          const node = (identifier: string) => ({
            identifier,
            title: `Issue ${identifier}`,
            description: 'Body',
            priority: 2,
            dueDate: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            state: { name: 'In Progress', type: 'started' },
            assignee: { name: 'Noa', email: 'noa@acme.dev' },
            labels: { nodes: [{ name: 'Bug' }] },
            parent: null,
            comments: { nodes: [] },
          });
          return body.variables.after
            ? {
                data: {
                  issues: { nodes: [node('CORE-2')], pageInfo: { hasNextPage: false, endCursor: null } },
                },
              }
            : {
                data: {
                  issues: { nodes: [node('CORE-1')], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
                },
              };
        },
      ],
    ]);
    const source = await linear.fetchSource(
      { apiKey: 'lin_api_123456' },
      'team-1',
      { includeComments: false, includeClosed: false },
      noProgress,
    );
    expect(source.tasks.map((task) => task.externalId)).toEqual(['CORE-1', 'CORE-2']);
    expect(source.tasks[0]).toMatchObject({ type: 'bug', priority: 'high', statusCategory: 'in_progress' });
    const variables = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body)).variables;
    expect(variables).toMatchObject({
      comments: false,
      filter: { team: { id: { eq: 'team-1' } }, state: { type: { nin: ['completed', 'canceled'] } } },
    });
  });

  it('skips pull requests and attaches repository comments to GitHub issues', async () => {
    mockApi([
      [
        /\/issues\/comments/,
        [
          {
            issue_url: 'https://api.github.com/repos/acme/web/issues/7',
            body: 'Repro attached',
            created_at: '2026-01-05T00:00:00Z',
            user: { login: 'octo' },
          },
        ],
      ],
      [
        /\/repos\/acme\/web\/issues\?/,
        [
          {
            number: 7,
            title: 'Broken nav',
            body: 'Details',
            state: 'open',
            labels: [{ name: 'bug' }, { name: 'priority: high' }],
            assignee: { login: 'octo' },
            milestone: { due_on: '2026-11-30T08:00:00Z' },
            created_at: '2026-01-04T00:00:00Z',
          },
          {
            number: 8,
            title: 'A PR',
            body: null,
            state: 'open',
            labels: [],
            assignee: null,
            milestone: null,
            created_at: '2026-01-04T00:00:00Z',
            pull_request: {},
          },
          {
            number: 9,
            title: 'Done thing',
            body: null,
            state: 'closed',
            labels: ['enhancement'],
            assignee: null,
            milestone: null,
            created_at: '2026-01-04T00:00:00Z',
          },
        ],
      ],
    ]);
    const source = await github.fetchSource({ token: 'ghp_1234567890' }, 'acme/web', ALL, noProgress);
    expect(source.tasks.map((task) => task.externalId)).toEqual(['#7', '#9']);
    expect(source.tasks[0]).toMatchObject({
      type: 'bug',
      priority: 'high',
      dueDate: '2026-11-30',
      comments: [{ body: 'Repro attached' }],
    });
    expect(source.tasks[1]).toMatchObject({ type: 'improvement', statusCategory: 'done', status: 'Closed' });
    await expect(
      github.fetchSource({ token: 'ghp_1234567890' }, '../../user', ALL, noProgress),
    ).rejects.toThrow();
  });
});

describe('migration jobs', () => {
  const waitFor = async (agent: ReturnType<typeof agentFor>, id: string, status: string) => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { body } = await agent.get(`/api/migrations/jobs/${id}`).expect(200);
      if (body.job.status === status) return body.job;
      if (body.job.status === 'failed') throw new Error(body.job.error);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`job never reached ${status}`);
  };

  it('fetches once, shows statuses and people, then imports into a new project with the chosen mapping', async () => {
    mockApi([
      [
        /\/list\/l1\/task/,
        {
          last_page: true,
          tasks: [
            {
              id: 'a',
              name: 'Kickoff',
              status: { status: 'to do', type: 'open' },
              priority: { priority: 'high' },
              assignees: [{ username: 'Me', email: 'MIGRATOR@test.dev' }],
              tags: [],
              due_date: null,
              start_date: null,
              date_created: null,
              parent: null,
            },
            {
              id: 'b',
              name: 'Design',
              status: { status: 'doing', type: 'custom' },
              priority: null,
              assignees: [{ username: 'Zed', email: 'zed@elsewhere.dev' }],
              tags: [],
              due_date: null,
              start_date: null,
              date_created: null,
              parent: null,
            },
          ],
        },
      ],
      [/\/list\/l1$/, { id: 'l1', name: 'Launch' }],
    ]);
    const agent = agentFor();
    const { user } = await registerUser(agent, { email: 'migrator@test.dev' });
    await agent.post('/api/migrations/notion/sources').send({ credentials: {} }).expect(404);
    await agent
      .post('/api/migrations/clickup/jobs')
      .send({ credentials: { token: 'x' }, sourceId: 'l1' })
      .expect(400);
    const started = await agent
      .post('/api/migrations/clickup/jobs')
      .send({ credentials: { token: 'pk_1234567890' }, sourceId: 'l1', includeComments: false })
      .expect(202);
    const ready = await waitFor(agent, started.body.job.id, 'ready');
    expect(ready).toMatchObject({ sourceName: 'Launch', total: 2 });
    expect(ready.statuses).toEqual([
      { name: 'to do', category: 'todo', count: 1 },
      { name: 'doing', category: 'in_progress', count: 1 },
    ]);
    expect(ready.people.map((person: { key: string }) => person.key)).toEqual([
      'migrator@test.dev',
      'zed@elsewhere.dev',
    ]);
    await agentFor().get(`/api/migrations/jobs/${started.body.job.id}`).expect(401);

    const project = { name: 'Launch', key: 'LAUNCH', color: '#4f56f0', icon: 'rocket' };
    await agent
      .post(`/api/migrations/jobs/${started.body.job.id}/commit`)
      .send({ target: { project } })
      .expect(202);
    const done = await waitFor(agent, started.body.job.id, 'done');
    expect(done.result).toMatchObject({ projectKey: 'LAUNCH', created: 2 });
    const { rows } = await pool.query(
      `SELECT t.title, t.assignee_id, s.name AS status, t.description FROM tasks t JOIN project_statuses s ON s.id = t.status_id ORDER BY t.number`,
    );
    expect(rows[0]).toMatchObject({ title: 'Kickoff', assignee_id: user.id, status: 'To Do' });
    expect(rows[1]).toMatchObject({ title: 'Design', assignee_id: null, status: 'In Progress' });
    expect(rows[1].description).toContain('Originally assigned to Zed in ClickUp.');
  });
});
