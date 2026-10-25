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
