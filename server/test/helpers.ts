import request from 'supertest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { clearMailbox, mailbox } from '../src/lib/mailer';

export const ORIGIN = new URL(config.APP_URL).origin;

export const resetDb = async () => {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (rows.length)
    await pool.query(
      `TRUNCATE ${rows.map((row) => `"${row.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  clearMailbox();
};

export const testApp = (options: Parameters<typeof createApp>[0] = { rateLimit: false }) =>
  createApp(options);

export type Agent = ReturnType<typeof request.agent>;

export const agentFor = (app = testApp()) => request.agent(app).set('Origin', ORIGIN);

let counter = 0;

export const registerUser = async (
  agent: Agent,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) => {
  counter += 1;
  const body = {
    name: `User ${counter}`,
    email: `user${counter}@test.dev`,
    password: 'correct-horse-1',
    ...overrides,
  };
  const response = await agent.post('/api/auth/register').send(body).expect(201);
  return { ...body, user: response.body.user as { id: string; email: string; name: string } };
};

export const lastLink = (to: string, path: string) => {
  const message = [...mailbox].reverse().find((mail) => mail.to === to && mail.text.includes(path));
  const match = message?.text.match(new RegExp(`${path}\\?token=([\\w-]+)`));
  return match?.[1];
};

export const projectInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Website Redesign',
  key: 'WEB',
  description: 'Marketing site',
  color: '#4f56f0',
  icon: 'globe',
  ...overrides,
});

export const subscribe = async (agent: Agent, tier: 'personal' | 'pro') =>
  agent.post('/api/shop/subscribe').send({ tier }).expect(201);

export const createHousehold = async (agent: Agent, overrides: Record<string, unknown> = {}) => {
  await subscribe(agent, 'personal');
  return createProject(agent, {
    name: 'Home',
    key: 'HOME',
    icon: 'house',
    module: 'household',
    ...overrides,
  });
};

export const createProject = async (agent: Agent, overrides: Record<string, unknown> = {}) =>
  (await agent.post('/api/projects').send(projectInput(overrides)).expect(201)).body.project as {
    id: string;
    key: string;
    roles: { id: string; name: string; systemKey: string | null; permissions: number }[];
    statuses: { id: string; workflow: string; name: string; category: string; position: string }[];
    labels: { id: string; name: string }[];
    memberList: { id: string; roleId: string; isOwner: boolean }[];
    permissions: number;
  };

export const roleId = (project: Awaited<ReturnType<typeof createProject>>, systemKey: string) =>
  project.roles.find((role) => role.systemKey === systemKey)!.id;

export const addMember = async (owner: Agent, key: string, email: string, role: string) =>
  owner.post(`/api/projects/${key}/members`).send({ email, roleId: role }).expect(201);

export const setupTeam = async () => {
  const owner = agentFor();
  const ownerAccount = await registerUser(owner);
  const project = await createProject(owner);
  const people: Record<string, { agent: Agent; id: string; email: string }> = {};
  for (const systemKey of ['admin', 'member', 'viewer']) {
    const agent = agentFor();
    const account = await registerUser(agent);
    await addMember(owner, project.key, account.email, roleId(project, systemKey));
    people[systemKey] = { agent, id: account.user.id, email: account.email };
  }
  const outsider = agentFor();
  await registerUser(outsider);
  return {
    owner,
    ownerId: ownerAccount.user.id,
    project,
    admin: people.admin!,
    member: people.member!,
    viewer: people.viewer!,
    outsider,
  };
};

export interface TaskResponse {
  id: string;
  number: number;
  identifier: string;
  projectKey: string;
  type: string;
  title: string;
  statusId: string;
  statusCategory: string;
  priority: string;
  assignee: { id: string; name: string } | null;
  reporterId: string | null;
  labels: { id: string; name: string }[];
  parentId: string | null;
  position: string;
  completedAt: string | null;
  subtaskTotal: number;
  subtaskDone: number;
  dueDate: string | null;
  isBlocked: boolean;
}

export const createTask = async (agent: Agent, key: string, body: Record<string, unknown> = {}) =>
  (
    await agent
      .post(`/api/projects/${key}/tasks`)
      .send({ title: 'A task', ...body })
      .expect(201)
  ).body.task as TaskResponse;

export const statusOf = (
  project: Awaited<ReturnType<typeof createProject>>,
  workflow: string,
  name: string,
) => project.statuses.find((status) => status.workflow === workflow && status.name === name)!.id;
