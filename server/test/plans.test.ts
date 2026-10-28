import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import {
  addMember,
  agentFor,
  createHousehold,
  createProject,
  projectInput,
  registerUser,
  resetDb,
  roleId,
  subscribe,
  type Agent,
} from './helpers';

beforeEach(resetDb);

const signUp = async () => {
  const agent = agentFor();
  const { user } = await registerUser(agent);
  return { agent, id: user.id };
};

const create = (agent: Agent, key: string, module = 'software') =>
  agent.post('/api/projects').send(projectInput({ key, name: key, module }));

const fillPlan = (userId: string, count: number, age = '1 day') =>
  pool.query(
    `INSERT INTO project_creations (user_id, created_at) SELECT $1, now() - $3::interval FROM generate_series(1, $2)`,
    [userId, count, age],
  );

const shop = async (agent: Agent) => (await agent.get('/api/shop').expect(200)).body;

describe('free plan', () => {
  it('starts software and personal projects, three a year', async () => {
    const { agent } = await signUp();
    expect(await shop(agent)).toEqual({
      plan: { tier: 'free', startsAt: null, expiresAt: null, projectsUsed: 0, projectsLimit: 3 },
      packs: [],
    });
    await create(agent, 'ONE').expect(201);
    const personal = await create(agent, 'TWO', 'personal').expect(201);
    expect(personal.body.project).toMatchObject({ kind: 'software', module: 'personal' });
    expect(personal.body.project.labels.map((label: { name: string }) => label.name)).toEqual([
      'Buy',
      'Do',
      'Idea',
      'Research',
      'Waiting',
    ]);
    await create(agent, 'THREE').expect(201);
    const fourth = await create(agent, 'FOUR').expect(402);
    expect(fourth.body.error).toBe(
      'Your Free plan allows 3 new projects a year — buy a Software pack for more',
    );
    expect((await shop(agent)).plan.projectsUsed).toBe(3);
  });

  it('needs Personal for a household and Pro for a startup', async () => {
    const { agent } = await signUp();
    expect((await create(agent, 'HOME', 'household').expect(402)).body.error).toBe(
      'Upgrade to Personal or buy Household projects to start one',
    );
    expect((await create(agent, 'IDEA', 'startup').expect(402)).body.error).toBe(
      'Upgrade to Pro or buy Startup idea projects to start one',
    );
  });

  it('counts the last 365 days and keeps a slot used after the project is deleted', async () => {
    const { agent, id } = await signUp();
    await fillPlan(id, 2, '13 months');
    await create(agent, 'ONE').expect(201);
    await agent.delete('/api/projects/ONE').expect(204);
    await create(agent, 'TWO').expect(201);
    await create(agent, 'THREE').expect(201);
    await create(agent, 'FOUR').expect(402);
  });
});

describe('paid plans', () => {
  it('Personal unlocks households and skills, and 150 projects a year', async () => {
    const { agent, id } = await signUp();
    await fillPlan(id, 3);
    await create(agent, 'MORE').expect(402);
    const { body } = await agent.post('/api/shop/subscribe').send({ tier: 'personal' }).expect(201);
    expect(body.plan).toMatchObject({ tier: 'personal', projectsUsed: 0, projectsLimit: 150 });
    expect(Date.parse(body.plan.expiresAt) - Date.parse(body.plan.startsAt)).toBeGreaterThan(
      364 * 86_400_000,
    );
    const home = await create(agent, 'HOME', 'household').expect(201);
    expect(home.body.project).toMatchObject({ kind: 'household', module: 'household' });
    await create(agent, 'SKILL', 'skill').expect(201);
    await create(agent, 'IDEA', 'startup').expect(402);
    await pool.query(`INSERT INTO project_creations (user_id) SELECT $1 FROM generate_series(1, 148)`, [id]);
    expect((await create(agent, 'FULL').expect(402)).body.error).toMatch(
      /Personal plan allows 150 new projects a year/,
    );
  });

  it('Pro unlocks every module, and the same or a lower plan is refused', async () => {
    const { agent } = await signUp();
    await subscribe(agent, 'personal');
    await agent.post('/api/shop/subscribe').send({ tier: 'personal' }).expect(409);
    await subscribe(agent, 'pro');
    expect((await shop(agent)).plan).toMatchObject({ tier: 'pro', projectsLimit: 350 });
    await agent.post('/api/shop/subscribe').send({ tier: 'personal' }).expect(409);
    await agent.post('/api/shop/subscribe').send({ tier: 'free' }).expect(400);
    await create(agent, 'IDEA', 'startup').expect(201);
  });

  it('falls back to Free when the plan expires', async () => {
    const { agent, id } = await signUp();
    await subscribe(agent, 'personal');
    await pool.query(
      "UPDATE subscriptions SET starts_at = now() - interval '2 years', expires_at = now() - interval '1 day' WHERE user_id = $1",
      [id],
    );
    expect((await shop(agent)).plan).toMatchObject({ tier: 'free', expiresAt: null });
    await create(agent, 'HOME', 'household').expect(402);
  });

  it('lets members use a household without any plan', async () => {
    const { agent: owner } = await signUp();
    const project = await createHousehold(owner);
    const member = agentFor();
    const account = await registerUser(member);
    await addMember(owner, project.key, account.email, roleId(project, 'member'));
    const list = (await member.get('/api/projects/HOME/lists').expect(200)).body.lists[0];
    await member.post(`/api/projects/HOME/lists/${list.id}/items`).send({ name: 'Milk' }).expect(201);
  });
});

describe('project packs', () => {
  it('lets a free user buy startup projects without changing the plan count', async () => {
    const { agent } = await signUp();
    const { body } = await agent
      .post('/api/shop/packs')
      .send({ module: 'startup', projects: 10 })
      .expect(201);
    expect(body.packs).toEqual([{ module: 'startup', projectsLeft: 10 }]);
    await create(agent, 'IDEA', 'startup').expect(201);
    expect(await shop(agent)).toMatchObject({
      plan: { tier: 'free', projectsUsed: 0 },
      packs: [{ module: 'startup', projectsLeft: 9 }],
    });
  });

  it('uses the plan first, then the oldest pack, and refuses when both run out', async () => {
    const { agent, id } = await signUp();
    await agent.post('/api/shop/packs').send({ module: 'software', projects: 1 }).expect(201);
    await agent.post('/api/shop/packs').send({ module: 'software', projects: 1 }).expect(201);
    await create(agent, 'ONE').expect(201);
    expect((await shop(agent)).packs).toEqual([{ module: 'software', projectsLeft: 2 }]);
    await fillPlan(id, 2);
    await create(agent, 'TWO').expect(201);
    await create(agent, 'THREE').expect(201);
    expect((await shop(agent)).packs).toEqual([]);
    await create(agent, 'FOUR').expect(402);
    const { rows } = await pool.query(
      'SELECT projects_used FROM module_packs WHERE user_id = $1 ORDER BY created_at',
      [id],
    );
    expect(rows.map((row) => row.projects_used)).toEqual([1, 1]);
  });

  it('sells 1 to 100 projects of an available module', async () => {
    const { agent } = await signUp();
    await agent.post('/api/shop/packs').send({ module: 'startup', projects: 0 }).expect(400);
    await agent.post('/api/shop/packs').send({ module: 'startup', projects: 101 }).expect(400);
    await agent.post('/api/shop/packs').send({ module: 'startup', projects: 2.5 }).expect(400);
    await agent.post('/api/shop/packs').send({ module: 'trip', projects: 10 }).expect(400);
    await agent.post('/api/shop/packs').send({ module: 'startup', projects: 25 }).expect(201);
  });
});

describe('races', () => {
  it('never goes over the yearly plan allowance', async () => {
    const { agent, id } = await signUp();
    await fillPlan(id, 2);
    const results = await Promise.all(['A1', 'A2', 'A3'].map((key) => create(agent, key)));
    expect(results.map((result) => result.status).sort()).toEqual([201, 402, 402]);
  });

  it('never uses a pack twice', async () => {
    const { agent, id } = await signUp();
    await agent.post('/api/shop/packs').send({ module: 'startup', projects: 1 }).expect(201);
    const results = await Promise.all(['B1', 'B2', 'B3'].map((key) => create(agent, key, 'startup')));
    expect(results.map((result) => result.status).sort()).toEqual([201, 402, 402]);
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM projects WHERE owner_id = $1', [
      id,
    ]);
    expect(rows[0].count).toBe(1);
  });
});

describe('demo data', () => {
  it('does not count against the plan', async () => {
    const { agent } = await signUp();
    await createProject(agent, { key: 'REAL' });
    await agent.post('/api/demo').send({ size: 'small', seed: 1 }).expect(201);
    expect((await shop(agent)).plan.projectsUsed).toBe(1);
  });
});
