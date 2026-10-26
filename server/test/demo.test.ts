import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { agentFor, createProject, createTask, registerUser, resetDb, testApp, type Agent } from './helpers';

beforeEach(resetDb);

const generate = (agent: Agent, body: Record<string, unknown> = { size: 'small', seed: 42 }) =>
  agent.post('/api/demo').send(body).expect(201);

const snapshot = async (agent: Agent) => {
  const projects = (await agent.get('/api/projects').query({ archived: 'all' })).body.projects as {
    key: string;
    name: string;
    isDemo: boolean;
  }[];
  const demo = projects.filter((project) => project.isDemo).sort((a, b) => a.name.localeCompare(b.name));
  const tasks: string[] = [];
  for (const project of demo) {
    const { body } = await agent
      .get(`/api/projects/${project.key}/tasks`)
      .query({ sort: 'number', dir: 'asc', limit: '500' });
    tasks.push(
      ...body.items.map(
        (task: { title: string; type: string; priority: string; statusCategory: string }) =>
          `${project.name}|${task.title}|${task.type}|${task.priority}|${task.statusCategory}`,
      ),
    );
  }
  return { demo, tasks };
};

describe('demo data', () => {
  it('generates a realistic small workspace', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const { body } = await generate(agent);
    expect(body.status).toMatchObject({ exists: true, seed: 42, size: 'small' });
    expect(body.status.counts.tasks).toBeGreaterThanOrEqual(70);
    expect(body.status.teammates.map((mate: { roleName: string }) => mate.roleName).sort()).toEqual([
      'Admin',
      'Child',
      'Child',
      'Guest',
      'Member',
      'Member',
      'Parent',
      'QA',
      'Viewer',
    ]);
    const projects = (await agent.get('/api/projects').query({ archived: 'all' })).body.projects as {
      kind: string;
      isDemo: boolean;
      isOwner: boolean;
      isArchived: boolean;
      isFavorite: boolean;
      stats: { total: number; overdue: number; completed: number };
    }[];
    expect(projects.every((project) => project.isDemo)).toBe(true);
    expect(projects.filter((project) => project.kind === 'household')).toHaveLength(1);
    expect(projects.some((project) => !project.isOwner)).toBe(true);
    expect(projects.some((project) => project.isArchived)).toBe(true);
    expect(projects.some((project) => project.isFavorite)).toBe(true);
    expect(projects.some((project) => project.stats.overdue > 0)).toBe(true);
    expect(projects.some((project) => project.stats.completed > 0)).toBe(true);
    const dashboard = (await agent.get('/api/dashboard')).body;
    expect(dashboard.completedTrend.some((count: number) => count > 0)).toBe(true);
    expect(dashboard.highPriorityBugs.length).toBeGreaterThan(0);
  });

  it('keeps denormalized counters consistent', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await generate(agent);
    const { rows } = await pool.query(`
      SELECT count(*)::int AS mismatches FROM tasks t WHERE
        t.comment_count <> (SELECT count(*) FROM task_comments c WHERE c.task_id = t.id) OR
        t.attachment_count <> (SELECT count(*) FROM attachments a WHERE a.task_id = t.id) OR
        t.checklist_total <> (SELECT count(*) FROM task_checklist_items i WHERE i.task_id = t.id) OR
        t.checklist_done <> (SELECT count(*) FROM task_checklist_items i WHERE i.task_id = t.id AND i.is_done) OR
        t.subtask_total <> (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id) OR
        (t.completed_at IS NULL) <> ((SELECT category FROM project_statuses s WHERE s.id = t.status_id) <> 'done') OR
        t.number > (SELECT task_seq FROM projects p WHERE p.id = t.project_id)`);
    expect(rows[0].mismatches).toBe(0);
  });

  it('is reproducible from the same seed and replaces the previous set', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await generate(agent, { size: 'small', seed: 7 });
    const first = await snapshot(agent);
    await generate(agent, { size: 'small', seed: 7 });
    const second = await snapshot(agent);
    expect(second.tasks).toEqual(first.tasks);
    expect(second.demo).toHaveLength(first.demo.length);
    await generate(agent, { size: 'small', seed: 8 });
    expect((await snapshot(agent)).tasks).not.toEqual(first.tasks);
  });

  it('generates the large set quickly', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const started = Date.now();
    const { body } = await generate(agent, { size: 'large', seed: 1 });
    expect(Date.now() - started).toBeLessThan(8000);
    expect(body.status.counts.tasks).toBeGreaterThanOrEqual(1800);
  });

  it('removes only demo data', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await createProject(agent, { key: 'REAL', name: 'Real work' });
    await createTask(agent, 'REAL', { title: 'Keep me' });
    const before = (
      await pool.query(
        'SELECT (SELECT count(*) FROM tasks)::int AS tasks, (SELECT count(*) FROM users)::int AS users',
      )
    ).rows[0];
    await generate(agent);
    await agent.delete('/api/demo').expect(204);
    const after = (
      await pool.query(
        'SELECT (SELECT count(*) FROM tasks)::int AS tasks, (SELECT count(*) FROM users)::int AS users',
      )
    ).rows[0];
    expect(after).toEqual(before);
    expect((await agent.get('/api/demo')).body.status.exists).toBe(false);
    expect(
      (await agent.get('/api/projects')).body.projects.map((project: { key: string }) => project.key),
    ).toEqual(['REAL']);
  });

  it('lets the owner view the app as a demo teammate and switch back', async () => {
    const agent = agentFor();
    const { user } = await registerUser(agent);
    const { body } = await generate(agent);
    const qa = body.status.teammates.find((mate: { roleName: string }) => mate.roleName === 'QA');
    const other = agentFor();
    await registerUser(other);
    await other.post(`/api/demo/impersonate/${qa.id}`).expect(404);
    const switched = await agent.post(`/api/demo/impersonate/${qa.id}`).expect(200);
    expect(switched.body.user).toMatchObject({ id: qa.id, impersonator: { id: user.id } });
    expect((await agent.get('/api/auth/me')).body.user.id).toBe(qa.id);
    await agent.post(`/api/demo/impersonate/${qa.id}`).expect(400);
    await agent.post('/api/demo').send({ size: 'small' }).expect(403);
    const back = await agent.post('/api/demo/impersonate/stop').expect(200);
    expect(back.body.user).toMatchObject({ id: user.id, impersonator: null });
    expect((await agent.get('/api/auth/me')).body.user.id).toBe(user.id);
  });

  it('does not let other users add demo teammates as members', async () => {
    const agent = agentFor();
    await registerUser(agent);
    const { body } = await generate(agent);
    const teammate = (
      await pool.query('SELECT email FROM users WHERE id = $1', [body.status.teammates[0].id])
    ).rows[0];
    const other = agentFor();
    await registerUser(other);
    const project = await createProject(other, { key: 'OTH' });
    const member = project.roles.find((role) => role.systemKey === 'member')!.id;
    await other.post('/api/projects/OTH/members').send({ email: teammate.email, roleId: member }).expect(404);
  });

  it('is unavailable when disabled', async () => {
    const agent = agentFor(testApp({ rateLimit: false, demoData: false }));
    await registerUser(agent);
    await agent.post('/api/demo').send({ size: 'small' }).expect(404);
    await agent.get('/api/demo').expect(404);
  });
});
