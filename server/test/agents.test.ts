import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import {
  agentFor,
  createProject,
  createTask,
  registerUser,
  resetDb,
  roleId,
  setupTeam,
  type Agent,
} from './helpers';
import { call, connect } from './mcpHelpers';

beforeEach(resetDb);

const grantsOf = async (agent: Agent) =>
  (await agent.get('/api/me/connections').expect(200)).body.apps as {
    id: string;
    name: string;
    worker: { id: string; name: string } | null;
  }[];

const hireWorker = async (owner: Agent, name = 'Claude worker') => {
  const { tokens } = await connect(owner);
  const [grant] = await grantsOf(owner);
  const { body } = await owner.post('/api/me/agents').send({ grantId: grant!.id, name }).expect(201);
  return { token: tokens.access_token, grantId: grant!.id, worker: body.workers[0] as { id: string } };
};

describe('AI workers', () => {
  it('turns a connection into a worker that only sees the projects it was added to', async () => {
    const { owner, project } = await setupTeam();
    await createProject(owner, { key: 'SIDE', name: 'Side project' });
    const { token, worker, grantId } = await hireWorker(owner);

    expect(await grantsOf(owner)).toEqual([
      expect.objectContaining({ id: grantId, worker: { id: worker.id, name: 'Claude worker' } }),
    ]);
    expect((await call(token, 'list_projects', {})).data.projects).toEqual([]);

    const { body } = await owner
      .post(`/api/projects/${project.key}/members/agents`)
      .send({ agentId: worker.id, roleId: roleId(project, 'member') })
      .expect(201);
    expect(body.member).toMatchObject({ id: worker.id, isAgent: true, email: '', roleName: 'Member' });

    const projects = (await call(token, 'list_projects', {})).data.projects as { key: string }[];
    expect(projects.map((item) => item.key)).toEqual([project.key]);
    expect((await call(token, 'fetch', { id: 'SIDE' })).text).toBe('Project not found');

    const assigned = await createTask(owner, project.key, { title: 'Draft the FAQ', assigneeId: worker.id });
    await createTask(owner, project.key, { title: 'Not for the worker' });
    const mine = (await call(token, 'my_tasks', {})).data.tasks as { identifier: string }[];
    expect(mine.map((task) => task.identifier)).toEqual([assigned.identifier]);

    const done = await call(token, 'update_task', { id: assigned.identifier, status: 'done' });
    expect(done.isError).toBe(false);
    const { rows } = await pool.query(
      "SELECT actor_id FROM task_activity WHERE task_id = $1 AND field = 'status'",
      [assigned.id],
    );
    expect(rows).toEqual([{ actor_id: worker.id }]);
  });

  it('follows the role it was given', async () => {
    const { owner, project } = await setupTeam();
    const { token, worker } = await hireWorker(owner);
    await owner
      .post(`/api/projects/${project.key}/members/agents`)
      .send({ agentId: worker.id, roleId: roleId(project, 'viewer') })
      .expect(201);
    const task = await createTask(owner, project.key, { title: 'Read only' });
    const result = await call(token, 'update_task', { id: task.identifier, title: 'Changed' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/missing permission/);
    await owner
      .post(`/api/projects/${project.key}/members/agents`)
      .send({ agentId: worker.id, roleId: roleId(project, 'owner') })
      .expect(400);
  });

  it("can't be added by someone else, by email, or as the owner", async () => {
    const { owner, project, admin } = await setupTeam();
    const { worker } = await hireWorker(owner);
    await admin.agent
      .post(`/api/projects/${project.key}/members/agents`)
      .send({ agentId: worker.id, roleId: roleId(project, 'member') })
      .expect(404);
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [worker.id]);
    await owner
      .post(`/api/projects/${project.key}/members`)
      .send({ email: rows[0].email, roleId: roleId(project, 'member') })
      .expect(404);
    const other = agentFor();
    await registerUser(other);
    await createProject(other, { key: 'OTH' });
    await other
      .post('/api/projects/OTH/members/agents')
      .send({ agentId: worker.id, roleId: roleId(project, 'member') })
      .expect(404);
    await owner.post('/api/auth/login').send({ email: rows[0].email, password: 'anything-1' }).expect(401);
  });

  it('needs a connection of your own that is not a worker yet', async () => {
    const { owner } = await setupTeam();
    const { grantId } = await hireWorker(owner);
    await owner.post('/api/me/agents').send({ grantId, name: 'Again' }).expect(404);
    const stranger = agentFor();
    await registerUser(stranger);
    await connect(stranger);
    const [theirs] = await grantsOf(stranger);
    await owner.post('/api/me/agents').send({ grantId: theirs!.id, name: 'Stolen' }).expect(404);
  });

  it('renames, moves to another connection and revokes the old one', async () => {
    const { owner } = await setupTeam();
    const { token, worker, grantId } = await hireWorker(owner);
    const second = await connect(owner);
    const fresh = (await grantsOf(owner)).find((grant) => grant.id !== grantId)!;
    const { body } = await owner
      .patch(`/api/me/agents/${worker.id}`)
      .send({ name: 'Cursor worker', grantId: fresh.id })
      .expect(200);
    expect(body.workers).toEqual([
      expect.objectContaining({
        id: worker.id,
        name: 'Cursor worker',
        connection: expect.objectContaining({ id: fresh.id }),
      }),
    ]);
    expect((await call(second.tokens.access_token, 'my_tasks', {})).isError).toBe(false);
    expect((await grantsOf(owner)).map((grant) => grant.id)).toEqual([fresh.id]);
    const old = await call(token, 'my_tasks', {}).catch(() => null);
    expect(old).toBeNull();
  });

  it('deleting a worker removes its connection and unassigns its open tasks', async () => {
    const { owner, project } = await setupTeam();
    const { worker } = await hireWorker(owner);
    await owner
      .post(`/api/projects/${project.key}/members/agents`)
      .send({ agentId: worker.id, roleId: roleId(project, 'member') })
      .expect(201);
    const task = await createTask(owner, project.key, { title: 'Pending', assigneeId: worker.id });
    await owner.delete(`/api/me/agents/${worker.id}`).expect(204);
    expect(await grantsOf(owner)).toEqual([]);
    expect((await owner.get(`/api/tasks/${task.id}`).expect(200)).body.task.assignee).toBeNull();
    expect((await owner.get('/api/me/agents').expect(200)).body.workers).toEqual([]);
  });

  it("is disconnected when the owner's password changes", async () => {
    const owner = agentFor();
    const account = await registerUser(owner);
    await hireWorker(owner);
    await owner
      .put('/api/me/password')
      .send({ currentPassword: account.password, newPassword: 'another-horse-2' })
      .expect(204);
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM oauth_grants');
    expect(rows[0].count).toBe(0);
  });
});
