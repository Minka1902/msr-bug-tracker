import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, resetDb, setupTeam, statusOf } from './helpers';

beforeEach(resetDb);

const seed = async () => {
  const team = await setupTeam();
  const { owner, project, member, ownerId } = team;
  const other = await createProject(owner, { key: 'APP', name: 'Mobile App' });
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const tasks = {
    done: await createTask(owner, project.key, {
      title: 'Ship landing page',
      statusId: statusOf(project, 'task', 'Done'),
      assigneeId: ownerId,
    }),
    progress: await createTask(owner, project.key, {
      title: 'Build pricing table',
      statusId: statusOf(project, 'task', 'In Progress'),
      assigneeId: ownerId,
      dueDate: soon,
    }),
    overdue: await createTask(owner, project.key, {
      title: 'Fix footer links',
      dueDate: yesterday,
      assigneeId: member.id,
    }),
    critical: await createTask(owner, other.key, {
      title: 'Checkout crashes',
      type: 'bug',
      priority: 'urgent',
      severity: 'critical',
      assigneeId: ownerId,
    }),
    minor: await createTask(owner, other.key, {
      title: 'Typo in settings',
      type: 'bug',
      priority: 'low',
      severity: 'trivial',
    }),
  };
  await owner.post(`/api/tasks/${tasks.done.id}/comments`).send({ body: 'Shipped!' });
  return { ...team, other, tasks };
};

describe('dashboard', () => {
  it('summarizes every active project in one response', async () => {
    const { owner, tasks } = await seed();
    const { body } = await owner.get('/api/dashboard').expect(200);
    expect(body.totals).toEqual({ total: 5, completed: 1, incomplete: 4, inProgress: 1, overdue: 1 });
    expect(body.projects.map((project: { key: string }) => project.key).sort()).toEqual(['APP', 'WEB']);
    expect(body.completedTrend).toHaveLength(14);
    expect(body.completedTrend.at(-1)).toBe(1);
    expect(body.createdTrend.at(-1)).toBe(5);
    expect(body.highPriorityBugs.map((task: { id: string }) => task.id)).toEqual([tasks.critical.id]);
    expect(body.upcoming.map((task: { id: string }) => task.id)).toEqual([tasks.progress.id]);
    expect(body.bugsBySeverity).toMatchObject({ critical: 1, trivial: 1 });
    expect(body.recentTasks[0]).toHaveProperty('identifier');
    expect(body.activity.length).toBeGreaterThan(0);
    expect(body.activity[0]).toHaveProperty('project.key');
  });

  it('ignores archived projects and projects the user is not in', async () => {
    const { owner, outsider } = await seed();
    await owner.post('/api/projects/APP/archive').expect(200);
    const { body } = await owner.get('/api/dashboard').expect(200);
    expect(body.totals.total).toBe(3);
    const empty = await outsider.get('/api/dashboard').expect(200);
    expect(empty.body.totals).toEqual({ total: 0, completed: 0, incomplete: 0, inProgress: 0, overdue: 0 });
  });
});

describe('my tasks', () => {
  it('lists tasks assigned to me across projects with filters', async () => {
    const { owner, tasks } = await seed();
    const { body } = await owner.get('/api/me/tasks').query({ sort: 'priority', dir: 'asc' }).expect(200);
    expect(body.items.map((task: { id: string }) => task.id)).toEqual([
      tasks.critical.id,
      tasks.progress.id,
      tasks.done.id,
    ]);
    const open = await owner.get('/api/me/tasks').query({ hideDone: 'true', project: 'WEB' }).expect(200);
    expect(open.body.items.map((task: { id: string }) => task.id)).toEqual([tasks.progress.id]);
  });
});

describe('project overview and activity', () => {
  it('breaks a project down by status, type and priority', async () => {
    const { owner, project } = await seed();
    const { body } = await owner.get('/api/projects/WEB/overview').expect(200);
    expect(body.stats).toMatchObject({ total: 3, completed: 1, active: 1, overdue: 1, progress: 33 });
    expect(
      body.byStatus.find((row: { statusId: string }) => row.statusId === statusOf(project, 'task', 'Done'))
        .count,
    ).toBe(1);
    expect(body.byType).toEqual({ task: 3 });
    expect(body.byPriority).toEqual({ medium: 2 });
  });

  it('pages the project activity feed', async () => {
    const { owner } = await seed();
    const first = await owner.get('/api/projects/WEB/activity').query({ limit: '2' }).expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.hasMore).toBe(true);
    const next = await owner
      .get('/api/projects/WEB/activity')
      .query({ limit: '2', before: String(first.body.items[1].id) })
      .expect(200);
    expect(next.body.items[0].id).toBeLessThan(first.body.items[1].id);
  });
});

describe('global search', () => {
  it('finds projects, exact identifiers and fuzzy titles the user can see', async () => {
    const { owner, outsider, tasks } = await seed();
    const foreign = await createProject(outsider, { key: 'OTH', name: 'Checkout service' });
    await createTask(outsider, foreign.key, { title: 'Checkout crashes on Android' });
    const byId = await owner.get('/api/search').query({ q: 'app-1' }).expect(200);
    expect(byId.body.tasks[0].id).toBe(tasks.critical.id);
    const byText = await owner.get('/api/search').query({ q: 'checkout cra' }).expect(200);
    expect(byText.body.tasks.map((task: { id: string }) => task.id)).toEqual([tasks.critical.id]);
    const fuzzy = await owner.get('/api/search').query({ q: 'pricng' }).expect(200);
    expect(fuzzy.body.tasks.map((task: { id: string }) => task.id)).toEqual([tasks.progress.id]);
    const projects = await owner.get('/api/search').query({ q: 'mobile' }).expect(200);
    expect(projects.body.projects.map((project: { key: string }) => project.key)).toEqual(['APP']);
    expect((await owner.get('/api/search').query({ q: '' }).expect(200)).body).toEqual({
      projects: [],
      tasks: [],
    });
  });
});
