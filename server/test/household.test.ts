import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { carryOverTasks } from '../src/modules/tasks/carryOver';
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

describe('carry over until done', () => {
  const taskById = async (agent: Awaited<ReturnType<typeof setupHousehold>>['parent'], id: string) =>
    (await agent.get(`/api/tasks/${id}`).expect(200)).body.task as Awaited<ReturnType<typeof createTask>>;

  it('turns carry over on for new household chores only, unless asked otherwise', async () => {
    const { parent, project } = await setupHousehold();
    const chore = await createTask(parent, project.key, { title: 'Dishes', type: 'chore' });
    const errand = await createTask(parent, project.key, { title: 'Post office', type: 'errand' });
    const optedOut = await createTask(parent, project.key, {
      title: 'Plants',
      type: 'chore',
      carryOver: false,
    });
    const optedIn = await createTask(parent, project.key, { title: 'Bank', type: 'errand', carryOver: true });
    expect([chore, errand, optedOut, optedIn].map((task) => task.carryOver)).toEqual([
      true,
      false,
      false,
      true,
    ]);

    await parent.patch(`/api/tasks/${chore.id}`).send({ carryOver: false }).expect(200);
    expect((await taskById(parent, chore.id)).carryOver).toBe(false);
  });

  it('moves unfinished carried tasks to today and keeps the gap from the start date', async () => {
    const { parent, project } = await setupHousehold();
    const late = await createTask(parent, project.key, {
      title: 'Laundry',
      type: 'chore',
      startDate: '2030-05-08',
      dueDate: '2030-05-10',
    });
    const done = await createTask(parent, project.key, {
      title: 'Dusting',
      type: 'chore',
      dueDate: '2030-05-10',
      statusId: statusOf(project, 'task', 'Done'),
    });
    const fixed = await createTask(parent, project.key, {
      title: 'Bins',
      type: 'errand',
      dueDate: '2030-05-10',
    });
    const onTime = await createTask(parent, project.key, {
      title: 'Cook',
      type: 'chore',
      dueDate: '2030-05-11',
    });
    await createProject(parent, { key: 'SOFT', name: 'Software' });
    const software = await createTask(parent, 'SOFT', {
      title: 'Ship',
      carryOver: true,
      dueDate: '2030-05-10',
    });

    await carryOverTasks(new Date('2030-05-11T12:00:00Z'));

    const moved = await taskById(parent, late.id);
    expect([moved.startDate, moved.dueDate]).toEqual(['2030-05-09', '2030-05-11']);
    expect((await taskById(parent, done.id)).dueDate).toBe('2030-05-10');
    expect((await taskById(parent, fixed.id)).dueDate).toBe('2030-05-10');
    expect((await taskById(parent, onTime.id)).dueDate).toBe('2030-05-11');
    expect((await taskById(parent, software.id)).dueDate).toBe('2030-05-10');
    const { body } = await parent.get(`/api/tasks/${late.id}/activity`).expect(200);
    expect(body.activity).toContainEqual(
      expect.objectContaining({
        action: 'carried_over',
        field: 'dueDate',
        oldValue: '2030-05-10',
        newValue: '2030-05-11',
      }),
    );
  });

  it("uses the assignee's time zone, then the reporter's, to decide the day has ended", async () => {
    const { parent, project, child } = await setupHousehold();
    await child.agent
      .patch('/api/me')
      .send({ preferences: { timezone: 'Asia/Jerusalem' } })
      .expect(200);
    await parent
      .patch('/api/me')
      .send({ preferences: { timezone: 'America/New_York' } })
      .expect(200);
    const childs = await createTask(parent, project.key, {
      title: 'Homework',
      type: 'chore',
      assigneeId: child.id,
      dueDate: '2030-05-10',
    });
    const unassigned = await createTask(parent, project.key, {
      title: 'Garden',
      type: 'chore',
      dueDate: '2030-05-10',
    });

    await carryOverTasks(new Date('2030-05-10T23:30:00Z'));

    expect((await taskById(parent, childs.id)).dueDate).toBe('2030-05-11');
    expect((await taskById(parent, unassigned.id)).dueDate).toBe('2030-05-10');
  });
});
