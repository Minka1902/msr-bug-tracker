import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
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
} from './helpers';

beforeEach(resetDb);

const setupHousehold = async () => {
  const parent = agentFor();
  const parentAccount = await registerUser(parent);
  const project = await createHousehold(parent);
  const people = [];
  for (const systemKey of ['member', 'member', 'viewer']) {
    const agent = agentFor();
    const account = await registerUser(agent);
    await addMember(parent, project.key, account.email, roleId(project, systemKey));
    people.push({ agent, id: account.user.id });
  }
  const outsider = agentFor();
  await registerUser(outsider);
  const [child, sibling, guest] = people as [
    (typeof people)[number],
    (typeof people)[number],
    (typeof people)[number],
  ];
  return { parent, parentId: parentAccount.user.id, project, child, sibling, guest, outsider };
};

describe('household projects', () => {
  it('sets up family roles, simple statuses, starter labels and a groceries list', async () => {
    const { parent, project } = await setupHousehold();
    expect(project).toMatchObject({ kind: 'household', module: 'household' });
    expect(project.roles.map((role) => [role.systemKey, role.name])).toEqual([
      ['owner', 'Owner'],
      ['admin', 'Parent'],
      ['member', 'Child'],
      ['viewer', 'Guest'],
    ]);
    expect(
      project.statuses.filter((status) => status.workflow === 'task').map((status) => status.name),
    ).toEqual(['To do', 'Doing', 'Done']);
    expect(project.labels.map((label) => label.name).sort()).toEqual([
      'Kitchen',
      'Laundry',
      'Outdoor',
      'Pets',
      'School',
    ]);
    const { body } = await parent.get('/api/projects/HOME/lists').expect(200);
    expect(body.lists).toEqual([expect.objectContaining({ name: 'Groceries', items: [] })]);
  });

  it('lets a child finish and take only their own chores', async () => {
    const { parent, project, child, sibling } = await setupHousehold();
    const done = statusOf(project, 'task', 'Done');
    const mine = await createTask(parent, 'HOME', {
      title: 'Feed the cat',
      type: 'chore',
      assigneeId: child.id,
    });
    const theirs = await createTask(parent, 'HOME', {
      title: 'Take out trash',
      type: 'chore',
      assigneeId: sibling.id,
    });
    const open = await createTask(parent, 'HOME', { title: 'Water plants', type: 'chore' });

    await child.agent.patch(`/api/tasks/${mine.id}`).send({ statusId: done }).expect(200);
    await child.agent.patch(`/api/tasks/${theirs.id}`).send({ statusId: done }).expect(403);
    await child.agent.patch(`/api/tasks/${open.id}`).send({ assigneeId: sibling.id }).expect(403);
    await child.agent.patch(`/api/tasks/${open.id}`).send({ assigneeId: child.id }).expect(200);
    await child.agent.post(`/api/tasks/${mine.id}/reopen`).expect(200);
    await sibling.agent.post(`/api/tasks/${mine.id}/reopen`).expect(403);
    await child.agent.post('/api/projects/HOME/tasks').send({ title: 'Buy a pony' }).expect(403);
    await child.agent
      .patch('/api/projects/HOME/tasks/bulk')
      .send({ ids: [mine.id, theirs.id], patch: { statusCategory: 'done' } })
      .expect(403);
  });

  it('creates the next occurrence exactly once, rotating the assignee', async () => {
    const { parent, project, child, sibling } = await setupHousehold();
    const done = statusOf(project, 'task', 'Done');
    const toDo = statusOf(project, 'task', 'To do');
    const kitchen = project.labels.find((label) => label.name === 'Kitchen')!.id;
    const dueDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const chore = await createTask(parent, 'HOME', {
      title: 'Dishes',
      type: 'chore',
      assigneeId: child.id,
      dueDate,
      labelIds: [kitchen],
      recurrence: { freq: 'weekly', interval: 1, rotate: [child.id, sibling.id] },
    });
    await parent.post(`/api/tasks/${chore.id}/checklist`).send({ text: 'Load the dishwasher' }).expect(201);

    await child.agent.patch(`/api/tasks/${chore.id}`).send({ statusId: done }).expect(200);
    await parent.post(`/api/tasks/${chore.id}/reopen`).expect(200);
    await parent.patch(`/api/tasks/${chore.id}`).send({ statusId: done }).expect(200);

    const { body } = await parent.get('/api/projects/HOME/tasks?q=Dishes').expect(200);
    expect(body.items).toHaveLength(2);
    const next = body.items.find((task: { id: string }) => task.id !== chore.id);
    const expectedDue = new Date(Date.parse(dueDate) + 7 * 86_400_000).toISOString().slice(0, 10);
    expect(next).toMatchObject({
      statusId: toDo,
      dueDate: expectedDue,
      assignee: expect.objectContaining({ id: sibling.id }),
      labels: [expect.objectContaining({ id: kitchen })],
      recurrence: { freq: 'weekly', interval: 1, rotate: [child.id, sibling.id] },
      checklistTotal: 1,
      checklistDone: 0,
    });
    expect(body.items.find((task: { id: string }) => task.id === chore.id).recurrence).toBeNull();

    await parent
      .patch('/api/projects/HOME/tasks/bulk')
      .send({ ids: [next.id], patch: { statusCategory: 'done' } })
      .expect(200);
    const after = await parent.get('/api/projects/HOME/tasks?q=Dishes').expect(200);
    expect(after.body.items).toHaveLength(3);
    expect(
      after.body.items.find((task: { id: string }) => ![chore.id, next.id].includes(task.id)),
    ).toMatchObject({
      assignee: expect.objectContaining({ id: child.id }),
    });
  });

  it('rejects rotations with people outside the household', async () => {
    const { parent, outsider } = await setupHousehold();
    const outsiderId = (await outsider.get('/api/auth/me')).body.user.id;
    await parent
      .post('/api/projects/HOME/tasks')
      .send({ title: 'Mow', recurrence: { freq: 'weekly', interval: 1, rotate: [outsiderId] } })
      .expect(400);
  });

  it('keeps existing software roles working with the new permissions', async () => {
    const owner = agentFor();
    await registerUser(owner);
    const project = await createProject(owner);
    const { rows } = await pool.query<{ permissions: number; system_key: string }>(
      'SELECT permissions, system_key FROM project_roles WHERE project_id = $1',
      [project.id],
    );
    const member = rows.find((row) => row.system_key === 'member')!.permissions;
    expect(member & (1 << 18)).not.toBe(0);
    expect(member & (1 << 19)).not.toBe(0);
  });
});

describe('shopping lists', () => {
  it('lets family members add and check items, guests only look, and hides lists from outsiders', async () => {
    const { parent, child, guest, outsider } = await setupHousehold();
    const [groceries] = (await parent.get('/api/projects/HOME/lists').expect(200)).body.lists;
    const base = `/api/projects/HOME/lists/${groceries.id}`;

    await child.agent.post(`${base}/items`).send({ name: 'Milk', quantity: '2 L' }).expect(201);
    const added = await parent.post(`${base}/items`).send({ name: 'Bread' }).expect(201);
    expect(added.body.list.items.map((item: { name: string }) => item.name)).toEqual(['Bread', 'Milk']);
    const milk = added.body.list.items.find((item: { name: string }) => item.name === 'Milk');

    const checked = await child.agent.patch(`${base}/items/${milk.id}`).send({ isChecked: true }).expect(200);
    expect(
      checked.body.list.items.map((item: { name: string; isChecked: boolean }) => [
        item.name,
        item.isChecked,
      ]),
    ).toEqual([
      ['Bread', false],
      ['Milk', true],
    ]);
    expect(checked.body.list.items[1].checkedBy).toMatchObject({ id: child.id });

    await guest.agent.get('/api/projects/HOME/lists').expect(200);
    await guest.agent.post(`${base}/items`).send({ name: 'Candy' }).expect(403);
    await outsider.get('/api/projects/HOME/lists').expect(404);
    await outsider.post(`${base}/items`).send({ name: 'Candy' }).expect(404);

    const cleared = await parent.post(`${base}/clear-checked`).expect(200);
    expect(cleared.body.list.items.map((item: { name: string }) => item.name)).toEqual(['Bread']);

    const second = await parent.post('/api/projects/HOME/lists').send({ name: 'Hardware' }).expect(201);
    await parent.delete(`/api/projects/HOME/lists/${second.body.list.id}`).expect(204);
    await parent
      .post(`/api/projects/HOME/lists/${second.body.list.id}/items`)
      .send({ name: 'Nails' })
      .expect(404);
  });
});
