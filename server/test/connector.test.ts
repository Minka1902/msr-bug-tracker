import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import {
  agentFor,
  createProject,
  createTask,
  registerUser,
  resetDb,
  setupTeam,
  testApp,
  type Agent,
} from './helpers';

beforeEach(resetDb);

const app = testApp();
const ORIGIN = new URL(config.APP_URL).origin;
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const ACCEPT = 'application/json, text/event-stream';

interface Client {
  client_id: string;
  client_secret: string;
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
}

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

const registerClient = async (name = 'Claude') =>
  (
    await request(app)
      .post('/oauth/register')
      .send({
        client_name: name,
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      })
      .expect(201)
  ).body as Client;

const startAuthorization = async (client: Client, challenge: string, scope = 'read write') => {
  const response = await request(app)
    .get('/oauth/authorize')
    .query({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'state-123',
      scope,
      resource: `${ORIGIN}/mcp`,
    })
    .expect(302);
  const consent = new URL(response.headers.location!);
  expect(consent.origin + consent.pathname).toBe(`${ORIGIN}/connect/authorize`);
  return consent.searchParams.get('request')!;
};

const approve = async (agent: Agent, sealed: string, scopes: string[]) => {
  const { body } = await agent
    .post('/api/connector/authorize')
    .send({ request: sealed, approve: true, scopes })
    .expect(200);
  const redirect = new URL(body.redirectUrl);
  expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
  expect(redirect.searchParams.get('state')).toBe('state-123');
  return redirect.searchParams.get('code')!;
};

const exchange = (client: Client, code: string, verifier: string) =>
  request(app).post('/oauth/token').type('form').send({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    client_id: client.client_id,
    client_secret: client.client_secret,
  });

const connect = async (agent: Agent, scopes = ['read', 'write'], client?: Client) => {
  const registered = client ?? (await registerClient());
  const { verifier, challenge } = pkce();
  const code = await approve(agent, await startAuthorization(registered, challenge), scopes);
  const tokens = (await exchange(registered, code, verifier).expect(200)).body as Tokens;
  return { client: registered, tokens };
};

let rpcId = 0;
const rpc = (token: string, method: string, params: Record<string, unknown> = {}) =>
  request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', ACCEPT)
    .send({ jsonrpc: '2.0', id: ++rpcId, method, params });

const toolNames = async (token: string) =>
  ((await rpc(token, 'tools/list').expect(200)).body.result.tools as { name: string }[]).map(
    (tool) => tool.name,
  );

const call = async (token: string, name: string, args: Record<string, unknown>) => {
  const { result } = (await rpc(token, 'tools/call', { name, arguments: args }).expect(200)).body as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  const text = result.content[0]!.text;
  return { isError: !!result.isError, text, data: result.isError ? null : JSON.parse(text) };
};

describe('Connector discovery', () => {
  it('advertises the authorization server and the protected MCP resource', async () => {
    const server = (await request(app).get('/.well-known/oauth-authorization-server').expect(200)).body;
    expect(server).toMatchObject({
      issuer: `${ORIGIN}/`,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      revocation_endpoint: `${ORIGIN}/oauth/revoke`,
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['read', 'write'],
    });
    for (const path of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource'])
      expect((await request(app).get(path).expect(200)).body).toMatchObject({
        resource: `${ORIGIN}/mcp`,
        authorization_servers: [`${ORIGIN}/`],
      });
  });

  it('asks for a token with a pointer to the resource metadata, and only accepts POST', async () => {
    const response = await request(app).post('/mcp').set('Accept', ACCEPT).send({}).expect(401);
    expect(response.headers['www-authenticate']).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
    );
    await request(app).get('/mcp').expect(405);
  });

  it('refuses redirect URIs that are not https, loopback or an app scheme', async () => {
    for (const uri of [
      'http://evil.example/cb',
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
    ])
      await request(app)
        .post('/oauth/register')
        .send({ client_name: 'Evil', redirect_uris: [uri] })
        .expect(400);
    await request(app)
      .post('/oauth/register')
      .send({ client_name: 'CLI', redirect_uris: ['http://localhost:33418/callback'] })
      .expect(201);
  });

  it('signs in desktop apps that return through their own scheme', async () => {
    const redirectUri = 'cursor://anysphere.cursor-mcp/oauth/callback';
    const cursor = (
      await request(app)
        .post('/oauth/register')
        .send({ client_name: 'Cursor', redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' })
        .expect(201)
    ).body as Client;
    const authorize = await request(app)
      .get('/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: cursor.client_id,
        redirect_uri: redirectUri,
        code_challenge: pkce().challenge,
        code_challenge_method: 'S256',
        state: 'cursor-state',
      })
      .expect(302);
    const sealed = new URL(authorize.headers.location!).searchParams.get('request')!;
    const agent = agentFor();
    await registerUser(agent);
    expect(
      (await agent.get('/api/connector/request').query({ request: sealed }).expect(200)).body.request,
    ).toMatchObject({ clientName: 'Cursor', redirectHost: 'cursor://anysphere.cursor-mcp' });
    const { body } = await agent
      .post('/api/connector/authorize')
      .send({ request: sealed, approve: true, scopes: ['read'] })
      .expect(200);
    expect(body.redirectUrl).toMatch(
      /^cursor:\/\/anysphere\.cursor-mcp\/oauth\/callback\?state=cursor-state&code=/,
    );
  });
});

describe('Connector sign-in', () => {
  it('runs the full code flow with PKCE, single-use codes and the chosen scopes', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const client = await registerClient();
    expect(client.client_secret).toBeTruthy();
    const { rows } = await pool.query('SELECT secret_sealed FROM oauth_clients');
    expect(rows[0].secret_sealed).toMatch(/^v1\./);

    const { verifier, challenge } = pkce();
    const sealed = await startAuthorization(client, challenge);
    expect(
      (await agent.get('/api/connector/request').query({ request: sealed }).expect(200)).body.request,
    ).toEqual({ clientName: 'Claude', redirectHost: 'claude.ai', scopes: ['read', 'write'] });
    const code = await approve(agent, sealed, ['read']);

    expect((await exchange(client, code, pkce().verifier).expect(400)).body.error).toBe('invalid_grant');
    const tokens = (await exchange(client, code, verifier).expect(200)).body as Tokens;
    expect(tokens).toMatchObject({ token_type: 'bearer', expires_in: 3600, scope: 'read' });
    expect((await exchange(client, code, verifier).expect(400)).body.error).toBe('invalid_grant');

    const init = await rpc(tokens.access_token, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'claude-ai', version: '1.0' },
    }).expect(200);
    expect(init.body.result).toMatchObject({
      serverInfo: { name: 'msr-tracker', title: 'MSR Tracker' },
      capabilities: { tools: {} },
      instructions: expect.stringContaining('list_projects'),
    });
    expect(init.headers['mcp-session-id']).toBeUndefined();

    const names = await toolNames(tokens.access_token);
    expect(names).toEqual(
      expect.arrayContaining(['list_projects', 'search', 'fetch', 'list_tasks', 'my_tasks']),
    );
    expect(names).not.toContain('create_task');
  });

  it('sends a declined request back with access_denied and rejects tampered or foreign requests', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const sealed = await startAuthorization(await registerClient(), pkce().challenge);
    const { body } = await agent
      .post('/api/connector/authorize')
      .send({ request: sealed, approve: false })
      .expect(200);
    const redirect = new URL(body.redirectUrl);
    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe('state-123');
    expect(redirect.searchParams.get('code')).toBeNull();
    await agent
      .get('/api/connector/request')
      .query({ request: `${sealed}x` })
      .expect(400);
    await agentFor().get('/api/connector/request').query({ request: sealed }).expect(401);
  });

  it('rotates refresh tokens, revokes tokens and lists or disconnects apps', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const { client, tokens } = await connect(agent);
    const refresh = () =>
      request(app).post('/oauth/token').type('form').send({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        client_secret: client.client_secret,
      });
    const next = (await refresh().expect(200)).body as Tokens;
    expect(next.scope).toBe('read write');
    expect((await refresh().expect(400)).body.error).toBe('invalid_grant');
    await rpc(tokens.access_token, 'tools/list').expect(401);
    await rpc(next.access_token, 'tools/list').expect(200);

    const apps = (await agent.get('/api/me/connections').expect(200)).body.apps;
    expect(apps).toEqual([
      expect.objectContaining({ name: 'Claude', host: 'claude.ai', scopes: ['read', 'write'] }),
    ]);
    await agentFor().get('/api/me/connections').expect(401);
    await agent.delete('/api/me/connections/not-a-uuid').expect(400);
    await agent.delete(`/api/me/connections/${apps[0].id}`).expect(204);
    await rpc(next.access_token, 'tools/list').expect(401);

    const again = await connect(agent, ['read'], client);
    await request(app)
      .post('/oauth/revoke')
      .type('form')
      .send({
        token: again.tokens.access_token,
        client_id: client.client_id,
        client_secret: client.client_secret,
      })
      .expect(200);
    await rpc(again.tokens.access_token, 'tools/list').expect(401);
  });

  it('drops connected apps when the password changes', async () => {
    const agent = agentFor();
    const { password } = await registerUser(agent);
    const { tokens } = await connect(agent);
    await agent
      .put('/api/me/password')
      .send({ currentPassword: password, newPassword: 'next-password-1' })
      .expect(204);
    await rpc(tokens.access_token, 'tools/list').expect(401);
  });

  it("doesn't connect apps while viewing the app as a demo teammate", async () => {
    const agent = agentFor();
    await registerUser(agent);
    const { body } = await agent.post('/api/demo').send({ size: 'small', seed: 42 }).expect(201);
    await agent.post(`/api/demo/impersonate/${body.status.teammates[0].id}`).expect(200);
    const sealed = await startAuthorization(await registerClient(), pkce().challenge);
    await agent.post('/api/connector/authorize').send({ request: sealed, approve: true }).expect(403);
  });
});

describe('Connector tools', () => {
  it('reads projects, searches and fetches tasks with names instead of ids', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await createProject(agent);
    const task = await createTask(agent, 'WEB', { title: 'Pricing page typo', type: 'bug' });
    await agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'Seen on mobile too' }).expect(201);
    const { tokens } = await connect(agent, ['read']);

    const projects = await call(tokens.access_token, 'list_projects', {});
    expect(projects.data.projects).toEqual([
      expect.objectContaining({ key: 'WEB', name: 'Website Redesign', url: `${ORIGIN}/p/WEB` }),
    ]);

    const found = await call(tokens.access_token, 'search', { query: 'pricing' });
    expect(found.data.results).toContainEqual(
      expect.objectContaining({
        id: task.identifier,
        kind: 'task',
        status: 'Open',
        url: `${ORIGIN}/t/${task.identifier}`,
      }),
    );

    const fetched = await call(tokens.access_token, 'fetch', { id: task.identifier });
    expect(fetched.data).toMatchObject({
      id: task.identifier,
      title: 'Pricing page typo',
      metadata: {
        status: 'Open',
        type: 'bug',
        comments: [expect.objectContaining({ body: 'Seen on mobile too' })],
      },
    });

    const project = await call(tokens.access_token, 'fetch', { id: 'web' });
    expect(project.data.metadata.statuses).toContainEqual({
      name: 'In Review',
      category: 'in_progress',
      workflow: 'task',
    });
    expect(project.data.metadata.members).toHaveLength(1);

    const listed = await call(tokens.access_token, 'list_tasks', { projectKey: 'WEB', status: ['todo'] });
    expect(listed.data.tasks.map((item: { identifier: string }) => item.identifier)).toEqual([
      task.identifier,
    ]);
  });

  it('creates and updates tasks, comments and checklists within your role', async () => {
    const team = await setupTeam();
    const { tokens } = await connect(team.member.agent);
    const created = await call(tokens.access_token, 'create_task', {
      projectKey: 'WEB',
      title: 'Write release notes',
      status: 'In Progress',
      assignee: 'me',
      priority: 'high',
      dueDate: '2026-12-01',
    });
    expect(created.data.task).toMatchObject({
      title: 'Write release notes',
      status: 'In Progress',
      priority: 'high',
      dueDate: '2026-12-01',
    });
    const id = created.data.task.identifier;

    const updated = await call(tokens.access_token, 'update_task', { id, status: 'done', dueDate: null });
    expect(updated.data.task).toMatchObject({ status: 'Done', statusCategory: 'done', dueDate: null });

    expect((await call(tokens.access_token, 'add_comment', { id, body: 'Shipped' })).isError).toBe(false);
    const checklist = await call(tokens.access_token, 'add_checklist_items', {
      id,
      items: ['Draft', 'Review'],
    });
    expect(checklist.data.added).toEqual(['Draft', 'Review']);
    expect((await call(tokens.access_token, 'my_tasks', { includeDone: true })).data.tasks).toHaveLength(1);

    const unknown = await call(tokens.access_token, 'update_task', { id, status: 'Nope' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('"In Review"');
    const stranger = await call(tokens.access_token, 'update_task', { id, assignee: 'nobody@test.dev' });
    expect(stranger.text).toContain("isn't a member");

    const dueSoon = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const scheduled = await call(tokens.access_token, 'create_task', {
      projectKey: 'WEB',
      title: 'Renew the certificate',
      dueDate: dueSoon,
      escalation: { from: 'low', to: 'urgent' },
    });
    expect(scheduled.data.task).toMatchObject({ priority: 'low', escalation: 'low → urgent' });
    const unscheduled = await call(tokens.access_token, 'update_task', {
      id: scheduled.data.task.identifier,
      escalation: null,
    });
    expect(unscheduled.data.task).not.toHaveProperty('escalation');

    const viewer = await connect(team.viewer.agent);
    const denied = await call(viewer.tokens.access_token, 'create_task', {
      projectKey: 'WEB',
      title: 'Nope',
    });
    expect(denied).toMatchObject({ isError: true });
    expect(denied.text).toContain('task.create');

    const outsider = await connect(team.outsider);
    const hidden = await call(outsider.tokens.access_token, 'fetch', { id: 'WEB' });
    expect(hidden).toMatchObject({ isError: true, text: 'Project not found' });
    expect((await call(outsider.tokens.access_token, 'fetch', { id })).text).toBe('Task not found');
  });

  it('handles shopping lists and calendar events', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await createProject(agent, { key: 'HOME', name: 'Home', kind: 'household', icon: 'house' });
    const { tokens } = await connect(agent);

    const added = await call(tokens.access_token, 'add_shopping_items', {
      projectKey: 'HOME',
      items: [{ name: 'Milk', quantity: '2' }, { name: 'Bread' }],
    });
    expect(added.data).toMatchObject({ list: 'Groceries' });
    const checked = await call(tokens.access_token, 'check_shopping_items', {
      projectKey: 'HOME',
      items: ['milk'],
    });
    expect(checked.data.items).toContainEqual({ name: 'Milk', quantity: '2', checked: true });
    expect(
      (await call(tokens.access_token, 'check_shopping_items', { projectKey: 'HOME', items: ['Eggs'] })).text,
    ).toContain('Not on "Groceries": Eggs');

    const event = await call(tokens.access_token, 'create_event', {
      title: 'Parents evening',
      startsAt: '2026-11-02',
      endsAt: '2026-11-03',
      allDay: true,
      projectKey: 'HOME',
    });
    expect(event.data.event).toMatchObject({ title: 'Parents evening', allDay: true, project: 'HOME' });
    const calendar = await call(tokens.access_token, 'list_calendar', {
      from: '2026-11-01',
      to: '2026-11-05',
    });
    const item = calendar.data.items.find((entry: { title: string }) => entry.title === 'Parents evening');
    expect(item).toMatchObject({ startsAt: '2026-11-02T00:00:00.000Z', endsAt: '2026-11-04T00:00:00.000Z' });
  });
});
