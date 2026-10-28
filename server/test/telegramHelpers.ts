import request from 'supertest';
import { expect, vi } from 'vitest';
import { config } from '../src/config';
import { addMember, agentFor, createHousehold, registerUser, roleId, testApp, type Agent } from './helpers';

export interface Chat {
  id: number;
  type: 'private' | 'group';
  title?: string;
}

interface Sent {
  chat_id: number;
  text: string;
}

export const BOT = 'msr_test_bot';
export const PARENT_TG = 101;
export const CHILD_TG = 202;
export const GUEST_TG = 303;
export const OTHER_PARENT_TG = 404;
export const GROUP: Chat = { id: -500, type: 'group', title: 'Family' };

export const telegramFailures = new Map<number, Response>();

export const telegramFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
  if (String(url).endsWith('/getMe')) return Response.json({ ok: true, result: { username: BOT } });
  const failure = telegramFailures.get((JSON.parse(String(init?.body)) as Sent).chat_id);
  return failure?.clone() ?? Response.json({ ok: true, result: {} });
});

let app: ReturnType<typeof testApp>;
let updateId = 0;

export const startTelegram = () => {
  config.TELEGRAM_BOT_TOKEN = 'test-token';
  vi.stubGlobal('fetch', telegramFetch);
  app = testApp();
};

export const stopTelegram = () => {
  config.TELEGRAM_BOT_TOKEN = undefined;
  vi.unstubAllGlobals();
};

export const telegramApp = () => app;

export const dm = (id: number): Chat => ({ id, type: 'private' });

export const postUpdate = (message: Record<string, unknown>, secret = config.telegramWebhookSecret) => {
  updateId += 1;
  return request(app)
    .post('/telegram/webhook')
    .set('X-Telegram-Bot-Api-Secret-Token', secret)
    .send({ update_id: updateId, message: { message_id: updateId, ...message } });
};

export const send = (chat: Chat, from: number, text: string, secret?: string) =>
  postUpdate({ chat, from: { id: from }, text }, secret);

export const reply = async (chat: Chat, from: number, text: string) =>
  (await send(chat, from, text).expect(200)).body.text as string;

export const sentMessages = () => {
  const sent = telegramFetch.mock.calls
    .filter(([url]) => String(url).endsWith('/sendMessage'))
    .map(([, init]) => JSON.parse(String(init?.body)) as Sent);
  telegramFetch.mockClear();
  return sent.map((message) => ({ chatId: message.chat_id, text: message.text }));
};

export const linkCode = async (agent: Agent, key: string, target: 'private' | 'group') => {
  const { body } = await agent.post(`/api/projects/${key}/telegram/link`).send({ target }).expect(200);
  const url = new URL(body.url as string);
  expect(url.pathname).toBe(`/${BOT}`);
  return url.searchParams.get(target === 'group' ? 'startgroup' : 'start')!;
};

export const connect = async (agent: Agent, key: string, chat: Chat, from: number) => {
  const code = await linkCode(agent, key, chat.type === 'group' ? 'group' : 'private');
  const text = chat.type === 'group' ? `/start@${BOT} ${code}` : `/start ${code}`;
  expect(await reply(chat, from, text)).toContain(`Connected to <b>${key}</b>`);
};

export const setupFamily = async () => {
  const parent = agentFor(app);
  const parentAccount = await registerUser(parent, { name: 'Dana Levi' });
  const project = await createHousehold(parent);
  const people: Record<string, { agent: Agent; id: string }> = {};
  for (const [name, systemKey] of [
    ['Avi Levi', 'admin'],
    ['Mia Levi', 'member'],
    ['Mike Levi', 'member'],
    ['Grandpa Joe', 'viewer'],
  ] as const) {
    const agent = agentFor(app);
    const account = await registerUser(agent, { name });
    await addMember(parent, project.key, account.email, roleId(project, systemKey));
    people[name] = { agent, id: account.user.id };
  }
  await connect(parent, 'HOME', dm(PARENT_TG), PARENT_TG);
  await connect(parent, 'HOME', GROUP, PARENT_TG);
  return {
    parent,
    parentId: parentAccount.user.id,
    project,
    otherParent: people['Avi Levi']!,
    child: people['Mia Levi']!,
    sibling: people['Mike Levi']!,
    guest: people['Grandpa Joe']!,
  };
};
