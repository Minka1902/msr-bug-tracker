import { beforeEach, describe, expect, it } from 'vitest';
import { call, connect } from './mcpHelpers';
import {
  addMember,
  agentFor,
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

const EXPERIMENT = { name: 'Experiment', base: 'task', icon: 'rocket', color: '#8b5cf6' };

const team = async () => {
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
  return { owner, project, admin: people.admin!, member: people.member! };
};

const addType = async (agent: Agent, key: string, body: Record<string, unknown>) =>
  (await agent.post(`/api/projects/${key}/card-types`).send(body).expect(201)).body.cardType as {
    id: string;
    name: string;
    base: string;
    createRoleIds: string[];
    editRoleIds: string[];
  };

describe('custom card types', () => {
  it('come with Startup projects and with the Pro plan', async () => {
    const free = agentFor();
    await registerUser(free);
    await createProject(free, { key: 'SOFT' });
    await free.post('/api/projects/SOFT/card-types').send(EXPERIMENT).expect(402);
    expect((await free.get('/api/projects/SOFT').expect(200)).body.project).toMatchObject({
      cardTypes: [],
      cardTypesAllowed: false,
    });

    await free.post('/api/shop/packs').send({ module: 'startup', projects: 10 }).expect(201);
    await createProject(free, { key: 'START', module: 'startup' });
    await addType(free, 'START', EXPERIMENT);

    const pro = agentFor();
    await registerUser(pro);
    await subscribe(pro, 'pro');
    await createProject(pro, { key: 'PRO' });
    const created = await addType(pro, 'PRO', { ...EXPERIMENT, base: 'bug', name: 'Security issue' });
    const { body } = await pro.get('/api/projects/PRO').expect(200);
    expect(body.project.cardTypesAllowed).toBe(true);
    expect(body.project.cardTypes).toEqual([
      { ...created, icon: 'rocket', color: '#8b5cf6', base: 'bug', createRoleIds: [], editRoleIds: [] },
    ]);
  });

  it('are managed by people who manage workflows, with valid roles and names', async () => {
    const { owner, project, member } = await team();
    await member.agent.post('/api/projects/IDEA/card-types').send(EXPERIMENT).expect(403);
    await owner
      .post('/api/projects/IDEA/card-types')
      .send({ ...EXPERIMENT, createRoleIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);
    await owner
      .post('/api/projects/IDEA/card-types')
      .send({ ...EXPERIMENT, base: 'chore' })
      .expect(400);
    const type = await addType(owner, 'IDEA', { ...EXPERIMENT, createRoleIds: [roleId(project, 'admin')] });
    await owner
      .post('/api/projects/IDEA/card-types')
      .send({ ...EXPERIMENT, name: 'experiment' })
      .expect(409);
    const renamed = await owner
      .patch(`/api/projects/IDEA/card-types/${type.id}`)
      .send({ name: 'Test', base: 'bug' })
      .expect(400);
    expect(renamed.body.error).toBe('Invalid input');
    const kept = await owner
      .patch(`/api/projects/IDEA/card-types/${type.id}`)
      .send({ name: 'Test' })
      .expect(200);
    expect(kept.body.cardType).toMatchObject({ name: 'Test', createRoleIds: [roleId(project, 'admin')] });

    for (let index = 1; index < 30; index += 1)
      await addType(owner, 'IDEA', { ...EXPERIMENT, name: `Type ${index}` });
    const full = await owner
      .post('/api/projects/IDEA/card-types')
      .send({ ...EXPERIMENT, name: 'One too many' })
      .expect(400);
    expect(full.body.error).toBe('A project can have up to 30 card types');
  });

  it('let only the chosen roles create cards of the type', async () => {
    const { owner, project, admin, member } = await team();
    const type = await addType(owner, 'IDEA', {
      ...EXPERIMENT,
      createRoleIds: [roleId(project, 'admin')],
      editRoleIds: [roleId(project, 'admin'), roleId(project, 'member')],
    });

    const denied = await member.agent
      .post('/api/projects/IDEA/tasks')
      .send({ title: 'Landing page test', cardTypeId: type.id })
      .expect(403);
    expect(denied.body.error).toBe("Your role (Member) can't create Experiment cards");
    await admin.agent
      .post('/api/projects/IDEA/tasks')
      .send({ title: 'Landing page test', type: 'bug', cardTypeId: type.id })
      .expect(400);
    const card = await createTask(admin.agent, 'IDEA', { title: 'Landing page test', cardTypeId: type.id });
    expect(card).toMatchObject({
      type: 'task',
      cardType: { id: type.id, name: 'Experiment', icon: 'rocket', color: '#8b5cf6' },
    });

    const plain = await createTask(member.agent, 'IDEA', { title: 'Plain' });
    await member.agent.patch(`/api/tasks/${plain.id}`).send({ cardTypeId: type.id }).expect(403);
    const switched = await admin.agent
      .patch(`/api/tasks/${plain.id}`)
      .send({ cardTypeId: type.id })
      .expect(200);
    expect(switched.body.task.cardType.name).toBe('Experiment');
    const back = await member.agent.patch(`/api/tasks/${plain.id}`).send({ type: 'feature' }).expect(200);
    expect(back.body.task).toMatchObject({ type: 'feature', cardType: null });

    await member.agent.post(`/api/tasks/${card.id}/duplicate`).expect(403);
    await admin.agent.post(`/api/tasks/${card.id}/duplicate`).expect(201);
  });

  it('let only the chosen roles edit and move cards of the type, while everyone can comment', async () => {
    const { owner, project, admin, member } = await team();
    const type = await addType(owner, 'IDEA', {
      ...EXPERIMENT,
      createRoleIds: [roleId(project, 'member')],
      editRoleIds: [roleId(project, 'admin')],
    });
    const card = await createTask(member.agent, 'IDEA', { title: 'Pricing test', cardTypeId: type.id });
    const done = statusOf(project, 'task', 'Done');

    const patch = await member.agent.patch(`/api/tasks/${card.id}`).send({ title: 'Renamed' }).expect(403);
    expect(patch.body.error).toBe("Your role (Member) can't edit Experiment cards");
    await member.agent.patch(`/api/tasks/${card.id}`).send({ statusId: done }).expect(403);
    await member.agent.post(`/api/tasks/${card.id}/checklist`).send({ text: 'Step' }).expect(403);
    const bulk = await member.agent
      .patch('/api/projects/IDEA/tasks/bulk')
      .send({ ids: [card.id], patch: { priority: 'high' } })
      .expect(403);
    expect(bulk.body.details.tasks).toEqual([card.identifier]);
    await member.agent.post(`/api/tasks/${card.id}/comments`).send({ body: 'Looks good' }).expect(201);

    await admin.agent.patch(`/api/tasks/${card.id}`).send({ statusId: done }).expect(200);
    await owner.patch(`/api/tasks/${card.id}`).send({ title: 'Owner can always edit' }).expect(200);
    await owner
      .post('/api/projects/IDEA/tasks/bulk-delete')
      .send({ ids: [card.id] })
      .expect(204);
  });

  it('carry over when a card moves to a project with the same type, and revert when deleted', async () => {
    const { owner } = await team();
    await createProject(owner, { key: 'NEXT', name: 'Next', module: 'startup' });
    const source = await addType(owner, 'IDEA', EXPERIMENT);
    const target = await addType(owner, 'NEXT', { ...EXPERIMENT, name: 'EXPERIMENT' });
    const other = await addType(owner, 'IDEA', { ...EXPERIMENT, name: 'Interview' });

    const card = await createTask(owner, 'IDEA', { title: 'Pricing test', cardTypeId: source.id });
    const moved = await owner.post(`/api/tasks/${card.id}/move`).send({ projectKey: 'NEXT' }).expect(200);
    expect(moved.body.task.cardType.id).toBe(target.id);

    const interview = await createTask(owner, 'IDEA', { title: 'Talk to Dana', cardTypeId: other.id });
    const lost = await owner.post(`/api/tasks/${interview.id}/move`).send({ projectKey: 'NEXT' }).expect(200);
    expect(lost.body.task).toMatchObject({ type: 'task', cardType: null });

    await owner.delete(`/api/projects/NEXT/card-types/${target.id}`).expect(204);
    expect((await owner.get(`/api/tasks/${card.id}`).expect(200)).body.task).toMatchObject({
      type: 'task',
      cardType: null,
    });
  });

  it('filter apart from their built-in type and work through the AI connector', async () => {
    const { owner } = await team();
    const type = await addType(owner, 'IDEA', EXPERIMENT);
    const plain = await createTask(owner, 'IDEA', { title: 'Plain task' });
    const pricing = await createTask(owner, 'IDEA', { title: 'Pricing test', cardTypeId: type.id });
    await owner
      .post(`/api/tasks/${plain.id}/relations`)
      .send({ target: pricing.identifier, type: 'relates' })
      .expect(201);
    const { body } = await owner.get(`/api/tasks/${plain.id}/relations`).expect(200);
    expect(body.relations[0].task.cardType).toMatchObject({ name: 'Experiment', icon: 'rocket' });
    const titles = async (filter: string) =>
      (
        (await owner.get(`/api/projects/IDEA/tasks?type=${filter}`).expect(200)).body.items as {
          title: string;
        }[]
      )
        .map((task) => task.title)
        .sort();
    expect(await titles('task')).toEqual(['Plain task']);
    expect(await titles(type.id)).toEqual(['Pricing test']);
    expect(await titles(`task,${type.id}`)).toEqual(['Plain task', 'Pricing test']);

    const { tokens } = await connect(owner);
    const token = tokens.access_token;
    const created = await call(token, 'create_task', {
      projectKey: 'IDEA',
      title: 'Onboarding test',
      type: 'experiment',
    });
    expect(created.data.task).toMatchObject({ type: 'Experiment', worksLike: 'task' });
    const listed = await call(token, 'list_tasks', { projectKey: 'IDEA', type: ['Experiment'] });
    expect(listed.data.tasks.map((task: { title: string }) => task.title).sort()).toEqual([
      'Onboarding test',
      'Pricing test',
    ]);
    const project = await call(token, 'fetch', { id: 'IDEA' });
    expect(project.data.metadata.cardTypes).toEqual([{ name: 'Experiment', worksLike: 'task' }]);
    const unknown = await call(token, 'create_task', { projectKey: 'IDEA', title: 'X', type: 'Spike' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('"Experiment"');
  });
});
