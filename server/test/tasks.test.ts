import { maskOf } from '@msr/shared/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import {
  addMember,
  createProject,
  createTask,
  resetDb,
  roleId,
  setupTeam,
  statusOf,
  type Agent,
} from './helpers';

beforeEach(resetDb);

const customRole = async (owner: Agent, key: string, name: string, permissions: number) =>
  (await owner.post(`/api/projects/${key}/roles`).send({ name, permissions }).expect(201)).body.role
    .id as string;

const activity = async (agent: Agent, taskId: string) =>
  (await agent.get(`/api/tasks/${taskId}/activity`).expect(200)).body.activity as {
    action: string;
    field: string | null;
    oldValue: unknown;
    newValue: unknown;
  }[];

describe('creating tasks', () => {
  it('numbers tasks per project and picks the first status of the right workflow', async () => {
    const { owner, ownerId, project } = await setupTeam();
    const first = await createTask(owner, project.key, { title: 'First' });
    const bug = await createTask(owner, project.key, { title: 'Crash', type: 'bug' });
    expect(first).toMatchObject({
      number: 1,
      identifier: 'WEB-1',
      statusId: statusOf(project, 'task', 'Backlog'),
      reporterId: ownerId,
      completedAt: null,
    });
    expect(bug).toMatchObject({ number: 2, identifier: 'WEB-2', statusId: statusOf(project, 'bug', 'Open') });
    expect((await activity(owner, first.id)).map((entry) => entry.action)).toEqual(['created']);
  });

  it('allocates unique sequential numbers under concurrency', async () => {
    const { owner, project } = await setupTeam();
    const tasks = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createTask(owner, project.key, { title: `T${index}` })),
    );
    expect(tasks.map((task) => task.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(new Set(tasks.map((task) => task.position)).size).toBe(20);
  });

  it('validates references and dates', async () => {
    const { owner, project, outsider } = await setupTeam();
    const other = await createProject(outsider, { key: 'OTH' });
    const outsiderId = (await outsider.get('/api/auth/me')).body.user.id;
    await owner.post('/api/projects/WEB/tasks').send({ title: '' }).expect(400);
    await owner
      .post('/api/projects/WEB/tasks')
      .send({ title: 'x', startDate: '2026-05-02', dueDate: '2026-05-01' })
      .expect(400);
    await owner.post('/api/projects/WEB/tasks').send({ title: 'x', assigneeId: outsiderId }).expect(400);
    await owner
      .post('/api/projects/WEB/tasks')
      .send({ title: 'x', statusId: statusOf(other, 'task', 'Done') })
      .expect(400);
    await owner
      .post('/api/projects/WEB/tasks')
      .send({ title: 'x', statusId: statusOf(project, 'bug', 'Open') })
      .expect(400);
    const foreignLabel = (
      await outsider.post('/api/projects/OTH/labels').send({ name: 'x', color: '#000000' })
    ).body.label.id;
    await owner
      .post('/api/projects/WEB/tasks')
      .send({ title: 'x', labelIds: [foreignLabel] })
      .expect(400);
  });

  it('is blocked in archived projects', async () => {
    const { owner, project } = await setupTeam();
    await owner.post(`/api/projects/${project.key}/archive`).expect(200);
    await owner.post('/api/projects/WEB/tasks').send({ title: 'x' }).expect(409);
  });
});

describe('updating tasks', () => {
  it('records each change and tracks completion by status category', async () => {
    const { owner, project, member } = await setupTeam();
    const task = await createTask(owner, project.key);
    const { body } = await owner
      .patch(`/api/tasks/${task.id}`)
      .send({
        title: 'Renamed',
        priority: 'urgent',
        assigneeId: member.id,
        statusId: statusOf(project, 'task', 'Done'),
      })
      .expect(200);
    expect(body.task).toMatchObject({
      title: 'Renamed',
      priority: 'urgent',
      assignee: { id: member.id },
      statusCategory: 'done',
    });
    expect(body.task.completedAt).not.toBeNull();
    const changes = (await activity(owner, task.id)).filter((entry) => entry.action === 'updated');
    expect(changes.map((entry) => entry.field).sort()).toEqual(['assignee', 'priority', 'status', 'title']);
    expect(changes.find((entry) => entry.field === 'status')).toMatchObject({
      oldValue: 'Backlog',
      newValue: 'Done',
    });
    const reopened = await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ statusId: statusOf(project, 'task', 'In Progress') })
      .expect(200);
    expect(reopened.body.task.completedAt).toBeNull();
  });

  it('remaps the status when the type moves to another workflow', async () => {
    const { owner, project } = await setupTeam();
    const inProgress = await createTask(owner, project.key, {
      statusId: statusOf(project, 'task', 'In Progress'),
    });
    const backlog = await createTask(owner, project.key);
    const a = await owner.patch(`/api/tasks/${inProgress.id}`).send({ type: 'bug' }).expect(200);
    const b = await owner.patch(`/api/tasks/${backlog.id}`).send({ type: 'bug' }).expect(200);
    expect(a.body.task.statusId).toBe(statusOf(project, 'bug', 'In Progress'));
    expect(b.body.task.statusId).toBe(statusOf(project, 'bug', 'Open'));
    await owner
      .patch(`/api/tasks/${inProgress.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(400);
  });

  it('reopens completed tasks into the first to-do status', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key, { statusId: statusOf(project, 'task', 'Done') });
    expect(task.completedAt).not.toBeNull();
    const { body } = await owner.post(`/api/tasks/${task.id}/reopen`).expect(200);
    expect(body.task).toMatchObject({ statusId: statusOf(project, 'task', 'To Do'), completedAt: null });
    await owner.post(`/api/tasks/${task.id}/reopen`).expect(400);
  });

  it('marks tasks blocked with a reason', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key);
    const { body } = await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ isBlocked: true, blockedReason: 'Waiting on API keys' })
      .expect(200);
    expect(body.task).toMatchObject({ isBlocked: true, blockedReason: 'Waiting on API keys' });
  });
});

describe('task permissions', () => {
  it('stops viewers and outsiders', async () => {
    const { owner, project, viewer, outsider } = await setupTeam();
    const task = await createTask(owner, project.key);
    await viewer.agent.post('/api/projects/WEB/tasks').send({ title: 'x' }).expect(403);
    await viewer.agent.patch(`/api/tasks/${task.id}`).send({ title: 'x' }).expect(403);
    await viewer.agent.get(`/api/tasks/${task.id}`).expect(200);
    for (const [method, path] of [
      ['get', `/api/tasks/${task.id}`],
      ['patch', `/api/tasks/${task.id}`],
      ['delete', `/api/tasks/${task.id}`],
      ['get', `/api/tasks/${task.id}/activity`],
      ['post', `/api/tasks/${task.id}/duplicate`],
      ['get', '/api/projects/WEB/tasks'],
      ['get', '/api/projects/WEB/board'],
      ['get', '/api/tasks/by-identifier/WEB-1'],
    ] as const) {
      await outsider[method](path).send({ title: 'x' }).expect(404);
    }
  });

  it('separates editing own tasks from any task', async () => {
    const { owner, project, member } = await setupTeam();
    const own = await customRole(owner, project.key, 'Reporter', maskOf('task.create', 'task.edit_own'));
    await owner.patch(`/api/projects/WEB/members/${member.id}`).send({ roleId: own }).expect(200);
    const mine = await createTask(member.agent, project.key);
    const theirs = await createTask(owner, project.key);
    await member.agent.patch(`/api/tasks/${mine.id}`).send({ title: 'Mine' }).expect(200);
    const denied = await member.agent.patch(`/api/tasks/${theirs.id}`).send({ title: 'Theirs' }).expect(403);
    expect(denied.body.details.missing).toEqual(['task.edit_any']);
    await member.agent
      .patch(`/api/tasks/${mine.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(403);
  });

  it('separates assigning yourself from assigning others', async () => {
    const { owner, project, member, viewer } = await setupTeam();
    const selfOnly = await customRole(owner, project.key, 'Picker', maskOf('task.assign_self'));
    await owner.patch(`/api/projects/WEB/members/${member.id}`).send({ roleId: selfOnly }).expect(200);
    const task = await createTask(owner, project.key);
    await member.agent.patch(`/api/tasks/${task.id}`).send({ assigneeId: viewer.id }).expect(403);
    await member.agent.patch(`/api/tasks/${task.id}`).send({ assigneeId: member.id }).expect(200);
    await member.agent.patch(`/api/tasks/${task.id}`).send({ assigneeId: null }).expect(200);
    await member.agent.post('/api/projects/WEB/tasks').send({ title: 'x' }).expect(403);
  });

  it('requires task.delete to delete', async () => {
    const { owner, project, admin, member } = await setupTeam();
    const task = await createTask(owner, project.key);
    await member.agent.delete(`/api/tasks/${task.id}`).expect(403);
    await admin.agent.delete(`/api/tasks/${task.id}`).expect(204);
    await owner.get(`/api/tasks/${task.id}`).expect(404);
  });
});

describe('subtasks', () => {
  it('keeps parent counters in sync and allows one level', async () => {
    const { owner, project } = await setupTeam();
    const parent = await createTask(owner, project.key);
    const child = await createTask(owner, project.key, { parentId: parent.id });
    const done = await createTask(owner, project.key, {
      parentId: parent.id,
      statusId: statusOf(project, 'task', 'Done'),
    });
    let fetched = (await owner.get(`/api/tasks/${parent.id}`)).body.task;
    expect(fetched).toMatchObject({ subtaskTotal: 2, subtaskDone: 1 });
    await owner
      .patch(`/api/tasks/${child.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(200);
    await owner.delete(`/api/tasks/${done.id}`).expect(204);
    fetched = (await owner.get(`/api/tasks/${parent.id}`)).body.task;
    expect(fetched).toMatchObject({ subtaskTotal: 1, subtaskDone: 1 });
    await owner.post('/api/projects/WEB/tasks').send({ title: 'grandchild', parentId: child.id }).expect(400);
    const { body } = await owner.get(`/api/tasks/${parent.id}/subtasks`).expect(200);
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([child.id]);
    await owner.delete(`/api/tasks/${parent.id}`).expect(204);
    await owner.get(`/api/tasks/${child.id}`).expect(404);
  });
});

describe('duplicating and moving', () => {
  it('duplicates fields and labels into a new number right after the original', async () => {
    const { owner, project } = await setupTeam();
    const label = (await owner.post('/api/projects/WEB/labels').send({ name: 'ui', color: '#3b82f6' })).body
      .label;
    const original = await createTask(owner, project.key, {
      title: 'Original',
      priority: 'high',
      labelIds: [label.id],
    });
    const next = await createTask(owner, project.key);
    const { body } = await owner.post(`/api/tasks/${original.id}/duplicate`).expect(201);
    expect(body.task).toMatchObject({
      number: 3,
      title: 'Original (copy)',
      priority: 'high',
      labels: [{ id: label.id }],
    });
    expect(body.task.position > original.position && body.task.position < next.position).toBe(true);
  });

  it('moves tasks with subtasks, remaps workflow and labels, and keeps old links working', async () => {
    const { owner, project, member } = await setupTeam();
    const target = await createProject(owner, { key: 'APP', name: 'App' });
    const source = (await owner.post('/api/projects/WEB/labels').send({ name: 'Frontend', color: '#3b82f6' }))
      .body.label;
    const matching = (
      await owner.post('/api/projects/APP/labels').send({ name: 'frontend', color: '#ef4444' })
    ).body.label;
    const task = await createTask(owner, project.key, {
      labelIds: [source.id],
      assigneeId: member.id,
      statusId: statusOf(project, 'task', 'In Review'),
    });
    const child = await createTask(owner, project.key, { parentId: task.id });
    const { body } = await owner.post(`/api/tasks/${task.id}/move`).send({ projectKey: 'APP' }).expect(200);
    expect(body.task).toMatchObject({
      projectKey: 'APP',
      number: 1,
      identifier: 'APP-1',
      assignee: null,
      statusId: statusOf(target, 'task', 'In Progress'),
    });
    expect(body.task.labels.map((label: { id: string }) => label.id)).toEqual([matching.id]);
    expect((await owner.get(`/api/tasks/${child.id}`)).body.task.projectKey).toBe('APP');
    expect((await owner.get('/api/tasks/by-identifier/WEB-1')).body.task.identifier).toBe('APP-1');
    expect((await owner.get('/api/tasks/by-identifier/web-2')).body.task.identifier).toBe('APP-2');
    await owner.get('/api/tasks/by-identifier/WEB-99').expect(404);
  });

  it('needs task.move here and task.create there', async () => {
    const { owner, project, admin } = await setupTeam();
    await createProject(owner, { key: 'APP', name: 'App' });
    const task = await createTask(owner, project.key);
    await admin.agent.post(`/api/tasks/${task.id}/move`).send({ projectKey: 'APP' }).expect(404);
    const app = (await owner.get('/api/projects/APP')).body.project;
    await addMember(owner, 'APP', admin.email, roleId(app, 'viewer'));
    await admin.agent.post(`/api/tasks/${task.id}/move`).send({ projectKey: 'APP' }).expect(403);
  });
});

describe('bulk updates', () => {
  it('maps a category to each workflow and checks ownership', async () => {
    const { owner, project, outsider } = await setupTeam();
    const task = await createTask(owner, project.key);
    const bug = await createTask(owner, project.key, { type: 'bug' });
    await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids: [task.id, bug.id], patch: { statusId: statusOf(project, 'task', 'Done') } })
      .expect(400);
    const { body } = await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids: [task.id, bug.id], patch: { statusCategory: 'done', priority: 'low' } })
      .expect(200);
    const byId = Object.fromEntries(body.tasks.map((item: { id: string }) => [item.id, item]));
    expect(byId[task.id]).toMatchObject({ statusId: statusOf(project, 'task', 'Done'), priority: 'low' });
    expect(byId[bug.id]).toMatchObject({ statusId: statusOf(project, 'bug', 'Resolved'), priority: 'low' });
    expect(byId[bug.id].completedAt).not.toBeNull();
    const foreign = await createProject(outsider, { key: 'OTH' });
    const foreignTask = await createTask(outsider, foreign.key);
    await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids: [task.id, foreignTask.id], patch: { priority: 'high' } })
      .expect(404);
  });

  it('reports which tasks the role cannot change', async () => {
    const { owner, project, member } = await setupTeam();
    const own = await customRole(owner, project.key, 'Reporter', maskOf('task.create', 'task.edit_own'));
    await owner.patch(`/api/projects/WEB/members/${member.id}`).send({ roleId: own }).expect(200);
    const mine = await createTask(member.agent, project.key);
    const theirs = await createTask(owner, project.key);
    const { body } = await member.agent
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids: [mine.id, theirs.id], patch: { priority: 'high' } })
      .expect(403);
    expect(body.details.tasks).toEqual([theirs.identifier]);
  });

  it('adds and removes labels and deletes in bulk', async () => {
    const { owner, project, member } = await setupTeam();
    const label = (await owner.post('/api/projects/WEB/labels').send({ name: 'ui', color: '#3b82f6' })).body
      .label;
    const tasks = await Promise.all([createTask(owner, project.key), createTask(owner, project.key)]);
    const ids = tasks.map((task) => task.id);
    let { body } = await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids, patch: { addLabelIds: [label.id] } })
      .expect(200);
    expect(body.tasks.every((task: { labels: unknown[] }) => task.labels.length === 1)).toBe(true);
    ({ body } = await owner
      .patch('/api/projects/WEB/tasks/bulk')
      .send({ ids, patch: { removeLabelIds: [label.id] } })
      .expect(200));
    expect(body.tasks.every((task: { labels: unknown[] }) => task.labels.length === 0)).toBe(true);
    await member.agent.post('/api/projects/WEB/tasks/bulk-delete').send({ ids }).expect(403);
    await owner.post('/api/projects/WEB/tasks/bulk-delete').send({ ids }).expect(204);
    expect((await owner.get('/api/projects/WEB/tasks')).body.items).toHaveLength(0);
  });
});

describe('listing, filtering and the board', () => {
  const seed = async () => {
    const team = await setupTeam();
    const { owner, project, member, ownerId } = team;
    const label = (await owner.post('/api/projects/WEB/labels').send({ name: 'ui', color: '#3b82f6' })).body
      .label;
    const tasks = {
      login: await createTask(owner, project.key, {
        title: 'Login crashes on Safari',
        type: 'bug',
        priority: 'urgent',
        assigneeId: ownerId,
        dueDate: '2020-01-01',
      }),
      search: await createTask(owner, project.key, {
        title: 'Search results pagination',
        priority: 'low',
        assigneeId: member.id,
        labelIds: [label.id],
      }),
      docs: await createTask(owner, project.key, {
        title: 'Write onboarding docs',
        priority: 'medium',
        statusId: statusOf(project, 'task', 'Done'),
        dueDate: '2020-01-01',
      }),
      blocked: await createTask(owner, project.key, {
        title: 'Payment webhook',
        priority: 'high',
        isBlocked: true,
      }),
    };
    return { ...team, label, tasks };
  };

  const titles = async (agent: Agent, query: Record<string, string>) =>
    ((await agent.get('/api/projects/WEB/tasks').query(query).expect(200)).body.items as { title: string }[])
      .map((task) => task.title)
      .sort();

  it('combines filters', async () => {
    const { owner, label, tasks } = await seed();
    expect(await titles(owner, { type: 'bug' })).toEqual([tasks.login.title]);
    expect(await titles(owner, { assignee: 'me' })).toEqual([tasks.login.title]);
    expect(await titles(owner, { assignee: 'none' })).toEqual([tasks.blocked.title, tasks.docs.title].sort());
    expect(await titles(owner, { label: label.id })).toEqual([tasks.search.title]);
    expect(await titles(owner, { overdue: 'true' })).toEqual([tasks.login.title]);
    expect(await titles(owner, { blocked: 'true' })).toEqual([tasks.blocked.title]);
    expect(await titles(owner, { category: 'done' })).toEqual([tasks.docs.title]);
    expect(await titles(owner, { priority: 'urgent,high', type: 'task' })).toEqual([tasks.blocked.title]);
    expect(await titles(owner, { q: 'pagin' })).toEqual([tasks.search.title]);
    expect(await titles(owner, { q: 'WEB-3' })).toEqual([tasks.docs.title]);
    expect(await titles(owner, { q: 'safari crash' })).toEqual([tasks.login.title]);
  });

  it('sorts and pages', async () => {
    const { owner } = await seed();
    const { body } = await owner
      .get('/api/projects/WEB/tasks')
      .query({ sort: 'priority', dir: 'asc', limit: '2' })
      .expect(200);
    expect(body.items.map((task: { priority: string }) => task.priority)).toEqual(['urgent', 'high']);
    expect(body.hasMore).toBe(true);
    const next = await owner
      .get('/api/projects/WEB/tasks')
      .query({ sort: 'priority', dir: 'asc', limit: '2', offset: '2' });
    expect(next.body.items.map((task: { priority: string }) => task.priority)).toEqual(['medium', 'low']);
    expect(next.body.hasMore).toBe(false);
  });

  it('returns every column of a workflow with totals and supports paging a column', async () => {
    const { owner, project } = await seed();
    const backlog = statusOf(project, 'task', 'Backlog');
    for (let index = 0; index < 3; index += 1)
      await createTask(owner, project.key, { title: `Extra ${index}` });
    const { body } = await owner
      .get('/api/projects/WEB/board')
      .query({ workflow: 'task', limit: '2' })
      .expect(200);
    expect(body.columns).toHaveLength(5);
    const column = body.columns.find((item: { statusId: string }) => item.statusId === backlog);
    expect(column.total).toBe(5);
    expect(column.tasks).toHaveLength(2);
    const more = await owner
      .get('/api/projects/WEB/board')
      .query({ workflow: 'task', statusId: backlog, limit: '2', offset: '2' })
      .expect(200);
    expect(more.body.columns[0].tasks).toHaveLength(2);
    const bugs = await owner.get('/api/projects/WEB/board').query({ workflow: 'bug' }).expect(200);
    expect(bugs.body.columns.flatMap((item: { tasks: unknown[] }) => item.tasks)).toHaveLength(1);
  });
});

describe('workflow and membership side effects', () => {
  it('moves tasks and syncs completion when a status is deleted', async () => {
    const { owner, project } = await setupTeam();
    const task = await createTask(owner, project.key, {
      statusId: statusOf(project, 'bug', 'Resolved'),
      type: 'bug',
    });
    await owner
      .delete(`/api/projects/WEB/statuses/${statusOf(project, 'bug', 'Resolved')}`)
      .send({ moveTo: statusOf(project, 'bug', 'In Progress') })
      .expect(204);
    const { body } = await owner.get(`/api/tasks/${task.id}`).expect(200);
    expect(body.task).toMatchObject({ statusId: statusOf(project, 'bug', 'In Progress'), completedAt: null });
  });

  it('unassigns open tasks when a member is removed', async () => {
    const { owner, project, member } = await setupTeam();
    const open = await createTask(owner, project.key, { assigneeId: member.id });
    const closed = await createTask(owner, project.key, {
      assigneeId: member.id,
      statusId: statusOf(project, 'task', 'Done'),
    });
    await owner.delete(`/api/projects/WEB/members/${member.id}`).expect(204);
    expect((await owner.get(`/api/tasks/${open.id}`)).body.task.assignee).toBeNull();
    expect((await owner.get(`/api/tasks/${closed.id}`)).body.task.assignee.id).toBe(member.id);
  });

  it('keeps denormalized subtask counters equal to recounts', async () => {
    const { owner, project } = await setupTeam();
    const parent = await createTask(owner, project.key);
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createTask(owner, project.key, { parentId: parent.id, title: `c${index}` }),
      ),
    );
    const { rows } = await pool.query(
      `SELECT t.subtask_total, (SELECT count(*)::int FROM tasks c WHERE c.parent_id = t.id) AS recount FROM tasks t WHERE t.id = $1`,
      [parent.id],
    );
    expect(rows[0].subtask_total).toBe(rows[0].recount);
  });
});
