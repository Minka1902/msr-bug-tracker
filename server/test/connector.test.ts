import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import {
  agentFor,
  createHousehold,
  createProject,
  createTask,
  registerUser,
  resetDb,
  setupTeam,
} from './helpers';
import {
  ACCEPT,
  app,
  approve,
  call,
  type Client,
  connect,
  exchange,
  ORIGIN,
  pkce,
  registerClient,
  rpc,
  startAuthorization,
  type Tokens,
  toolNames,
} from './mcpHelpers';

beforeEach(resetDb);

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
    await createHousehold(agent);
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
