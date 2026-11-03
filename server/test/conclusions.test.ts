import { beforeEach, describe, expect, it } from 'vitest';
import { call, connect } from './mcpHelpers';
import {
  addMember,
  agentFor,
  createHousehold,
  createProject,
  createTask,
  registerUser,
  resetDb,
  roleId,
  statusOf,
  subscribe,
  type Agent,
} from './helpers';

beforeEach(resetDb);

const startup = async () => {
  const owner = agentFor();
  await registerUser(owner);
  await subscribe(owner, 'pro');
  const project = await createProject(owner, { key: 'IDEA', name: 'Idea', module: 'startup' });
  const people: Record<string, { agent: Agent; id: string }> = {};
  for (const systemKey of ['admin', 'member']) {
    const agent = agentFor();
    const account = await registerUser(agent);
    await addMember(owner, project.key, account.email, roleId(project, systemKey));
    people[systemKey] = { agent, id: account.user.id };
  }
  const admins = [roleId(project, 'admin')];
  const boardDecision = (
    await owner
      .post('/api/projects/IDEA/card-types')
      .send({
        name: 'Board decision',
        base: 'discussion',
        icon: 'gavel',
        color: '#8b5cf6',
        createRoleIds: admins,
        editRoleIds: admins,
        viewRoleIds: admins,
      })
      .expect(201)
  ).body.cardType as { id: string; viewRoleIds: string[] };
  return {
    owner,
    project,
    admin: people.admin!,
    member: people.member!,
    boardDecision,
    done: statusOf(project, 'task', 'Done'),
  };
};

const discussion = (agent: Agent, key: string, body: Record<string, unknown> = {}) =>
  createTask(agent, key, { title: 'Open question', type: 'discussion', ...body });

const titles = (items: { title: string }[]) => items.map((item) => item.title).sort();

describe('who can see a card type', () => {
  it('keeps restricted cards away from roles that cannot see them, everywhere', async () => {
    const { owner, admin, member, boardDecision, done } = await startup();
    expect(boardDecision.viewRoleIds).toHaveLength(1);
    const secret = await discussion(owner, 'IDEA', {
      title: 'Raise a seed round',
      cardTypeId: boardDecision.id,
      statusId: done,
      decision: 'Yes, 1.5M at a 12M cap',
    });
    await discussion(owner, 'IDEA', { title: 'Pick a payment provider', statusId: done, decision: 'Stripe' });
    await owner.post(`/api/tasks/${secret.id}/comments`).send({ body: 'Seed terms attached' }).expect(201);

    const list = (agent: Agent) => agent.get('/api/projects/IDEA/tasks').expect(200);
    expect(titles((await list(member.agent)).body.items)).toEqual(['Pick a payment provider']);
    expect(titles((await list(admin.agent)).body.items)).toEqual([
      'Pick a payment provider',
      'Raise a seed round',
    ]);

    const board = (await member.agent.get('/api/projects/IDEA/board?workflow=task').expect(200)).body.columns;
    expect(board.reduce((sum: number, column: { total: number }) => sum + column.total, 0)).toBe(1);
    await member.agent.get(`/api/tasks/${secret.id}`).expect(404);
    await member.agent.get(`/api/tasks/by-identifier/${secret.identifier}`).expect(404);
    await member.agent.get(`/api/tasks/${secret.id}/comments`).expect(404);
    await admin.agent.get(`/api/tasks/${secret.id}`).expect(200);

    expect((await member.agent.get('/api/search?q=seed').expect(200)).body.tasks).toEqual([]);
    expect(titles((await member.agent.get('/api/dashboard').expect(200)).body.recentTasks)).toEqual([
      'Pick a payment provider',
    ]);
    expect((await member.agent.get('/api/projects/IDEA/overview').expect(200)).body.byType).toEqual({
      discussion: 1,
    });
    const activity = (await member.agent.get('/api/projects/IDEA/activity').expect(200)).body.items;
    expect(activity.some((entry: { task: { id: string } | null }) => entry.task?.id === secret.id)).toBe(
      false,
    );
    const [summary] = (await member.agent.get('/api/projects').expect(200)).body.projects;
    expect(summary.stats.total).toBe(1);

    const { tokens } = await connect(member.agent);
    const listed = await call(tokens.access_token, 'list_tasks', { projectKey: 'IDEA', includeDone: true });
    expect(listed.data.tasks.map((task: { identifier: string }) => task.identifier)).not.toContain(
      secret.identifier,
    );
    expect((await call(tokens.access_token, 'fetch', { id: secret.identifier })).isError).toBe(true);

    await owner.patch(`/api/tasks/${secret.id}`).send({ assigneeId: member.id }).expect(200);
    await member.agent.get(`/api/tasks/${secret.id}`).expect(200);
  });

  it('needs the roles that create or edit a type to see it too', async () => {
    const { owner, project, boardDecision } = await startup();
    const refused = await owner
      .post('/api/projects/IDEA/card-types')
      .send({
        name: 'Hiring',
        base: 'task',
        icon: 'users',
        color: '#10b981',
        createRoleIds: [roleId(project, 'member')],
        viewRoleIds: [roleId(project, 'admin')],
      })
      .expect(400);
    expect(refused.body.error).toBe('Roles that create or edit these cards must also be able to see them');
    await owner
      .patch(`/api/projects/IDEA/card-types/${boardDecision.id}`)
      .send({ viewRoleIds: [roleId(project, 'member')] })
      .expect(400);
    await owner
      .patch(`/api/projects/IDEA/card-types/${boardDecision.id}`)
      .send({ viewRoleIds: [] })
      .expect(200);
  });
});

describe('conclusions', () => {
  it('lists decided and open discussions, newest decision first, with paging and search', async () => {
    const { owner, admin, member, boardDecision, done } = await startup();
    for (const [title, decision] of [
      ['Which payment provider?', 'Stripe, for the fees'],
      ['Where do we host?', 'Render for now'],
      ['Office or remote?', 'Remote first'],
    ])
      await discussion(owner, 'IDEA', { title, statusId: done, decision });
    await discussion(owner, 'IDEA', { title: 'Raise a seed round', cardTypeId: boardDecision.id });
    await discussion(owner, 'IDEA', { title: 'Name the product' });
    await createTask(owner, 'IDEA', { title: 'Not a discussion', statusId: done });

    const first = (await member.agent.get('/api/projects/IDEA/conclusions?limit=2').expect(200)).body;
    expect(first.items.map((item: { title: string }) => item.title)).toEqual([
      'Office or remote?',
      'Where do we host?',
    ]);
    expect(first.items[0].decision).toBe('Remote first');
    expect(first.hasMore).toBe(true);
    expect(titles(first.open)).toEqual(['Name the product']);

    const last = first.items.at(-1);
    const second = (
      await member.agent
        .get('/api/projects/IDEA/conclusions')
        .query({ limit: 2, before: last.completedAt, beforeId: last.id })
        .expect(200)
    ).body;
    expect(second).toMatchObject({ hasMore: false, open: [] });
    expect(second.items.map((item: { title: string }) => item.title)).toEqual(['Which payment provider?']);

    const found = (await member.agent.get('/api/projects/IDEA/conclusions?q=render').expect(200)).body;
    expect(found.items.map((item: { title: string }) => item.title)).toEqual(['Where do we host?']);
    expect(titles((await admin.agent.get('/api/projects/IDEA/conclusions').expect(200)).body.open)).toEqual([
      'Name the product',
      'Raise a seed round',
    ]);
  });

  it('belongs to Startup, Software and Household projects only', async () => {
    const owner = agentFor();
    await registerUser(owner);
    await createProject(owner, { key: 'WEB' });
    await createProject(owner, { key: 'GOAL', module: 'personal' });
    await createHousehold(owner);
    await owner.get('/api/projects/WEB/conclusions').expect(200);
    await owner.get('/api/projects/HOME/conclusions').expect(200);
    await owner.get('/api/projects/GOAL/conclusions').expect(404);
  });
});
