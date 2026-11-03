import { beforeEach, describe, expect, it } from 'vitest';
import { call, connect } from './mcpHelpers';
import {
  agentFor,
  createHousehold,
  createProject,
  createTask,
  registerUser,
  resetDb,
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
  return {
    owner,
    project,
    done: statusOf(project, 'task', 'Done'),
    todo: statusOf(project, 'task', 'To Do'),
  };
};

const discussion = (agent: Agent, key: string, body: Record<string, unknown> = {}) =>
  createTask(agent, key, { title: 'Which payment provider?', type: 'discussion', ...body });

describe('discussions', () => {
  it('needs a decision before it can be closed', async () => {
    const { owner, done } = await startup();
    const task = await discussion(owner, 'IDEA');

    const refused = await owner.patch(`/api/tasks/${task.id}`).send({ statusId: done }).expect(400);
    expect(refused.body).toMatchObject({
      error: 'Add a decision before closing IDEA-1',
      details: { code: 'decision_required', tasks: ['IDEA-1'] },
    });
    await owner.patch(`/api/tasks/${task.id}`).send({ statusId: done, decision: '   ' }).expect(400);

    const closed = await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ statusId: done, decision: 'Stripe: lowest fees for our volume' })
      .expect(200);
    expect(closed.body.task).toMatchObject({
      statusCategory: 'done',
      decision: 'Stripe: lowest fees for our volume',
    });
    expect(closed.body.task.completedAt).not.toBeNull();

    await owner.patch(`/api/tasks/${task.id}`).send({ decision: '' }).expect(400);
    await owner.post(`/api/tasks/${task.id}/reopen`).expect(200);
    await owner.patch(`/api/tasks/${task.id}`).send({ decision: '' }).expect(200);
  });

  it('checks creating, retyping and bulk closing', async () => {
    const { owner, done } = await startup();
    await owner
      .post('/api/projects/IDEA/tasks')
      .send({ title: 'Closed already', type: 'discussion', statusId: done })
      .expect(400);
    const decided = await discussion(owner, 'IDEA', { statusId: done, decision: 'Yes' });
    expect(decided.statusCategory).toBe('done');

    const task = await createTask(owner, 'IDEA', { title: 'Plain', statusId: done });
    const retyped = await owner.patch(`/api/tasks/${task.id}`).send({ type: 'discussion' }).expect(400);
    expect(retyped.body.details.tasks).toEqual([task.identifier]);

    const open = [await discussion(owner, 'IDEA'), await discussion(owner, 'IDEA')];
    const other = await createTask(owner, 'IDEA', { title: 'Ship it' });
    const bulk = await owner
      .patch('/api/projects/IDEA/tasks/bulk')
      .send({ ids: [...open.map((item) => item.id), other.id], patch: { statusCategory: 'done' } })
      .expect(400);
    expect(bulk.body.details).toEqual({
      code: 'decision_required',
      tasks: open.map((item) => item.identifier),
    });
    expect((await owner.get(`/api/tasks/${other.id}`).expect(200)).body.task.statusCategory).not.toBe('done');
  });

  it('refuses to turn a status with undecided discussions into a done status', async () => {
    const { owner, todo } = await startup();
    await discussion(owner, 'IDEA', { statusId: todo });
    const refused = await owner
      .patch(`/api/projects/IDEA/statuses/${todo}`)
      .send({ category: 'done' })
      .expect(400);
    expect(refused.body.details.code).toBe('decision_required');
  });

  it('keeps the decision on a duplicate', async () => {
    const { owner, done } = await startup();
    const task = await discussion(owner, 'IDEA', { statusId: done, decision: 'Rent the van' });
    const copy = await owner.post(`/api/tasks/${task.id}/duplicate`).expect(201);
    expect(copy.body.task).toMatchObject({ statusCategory: 'done', decision: 'Rent the van' });
  });

  it('works the same in software and personal projects', async () => {
    const owner = agentFor();
    await registerUser(owner);
    for (const [key, module] of [
      ['WEB', 'software'],
      ['GOAL', 'personal'],
    ] as const) {
      const project = await createProject(owner, { key, name: key, module });
      const task = await discussion(owner, key);
      const done = statusOf(project, 'task', 'Done');
      await owner.patch(`/api/tasks/${task.id}`).send({ statusId: done }).expect(400);
      await owner.patch(`/api/tasks/${task.id}`).send({ statusId: done, decision: 'Go' }).expect(200);
    }
  });

  it('is offered in households and closes through the AI connector with a decision', async () => {
    const owner = agentFor();
    await registerUser(owner);
    const home = await createHousehold(owner);
    const task = await discussion(owner, home.key, { title: 'Where do we go this summer?' });
    const { tokens } = await connect(owner);

    const refused = await call(tokens.access_token, 'update_task', { id: task.identifier, status: 'done' });
    expect(refused).toMatchObject({
      isError: true,
      text: `Add a decision before closing ${task.identifier}`,
    });

    const closed = await call(tokens.access_token, 'update_task', {
      id: task.identifier,
      status: 'done',
      decision: 'Crete in August',
    });
    expect(closed.data.task.statusCategory).toBe('done');
    const fetched = await call(tokens.access_token, 'fetch', { id: task.identifier });
    expect(fetched.data.metadata.decision).toBe('Crete in August');
  });
});
