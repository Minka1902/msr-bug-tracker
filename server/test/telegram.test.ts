import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import {
  addMember,
  agentFor,
  createHousehold,
  createProject,
  registerUser,
  resetDb,
  roleId,
  subscribe,
  testApp,
  type Agent,
} from './helpers';

interface Chat {
  id: number;
  type: 'private' | 'group';
  title?: string;
}

const BOT = 'msr_test_bot';
const PARENT_TG = 101;
const CHILD_TG = 202;
const GUEST_TG = 303;
const GROUP: Chat = { id: -500, type: 'group', title: 'Family' };

let app: ReturnType<typeof testApp>;
let updateId = 0;

const dm = (id: number): Chat => ({ id, type: 'private' });

const send = (chat: Chat, from: number, text: string, secret = config.telegramWebhookSecret) => {
  updateId += 1;
  return request(app)
    .post('/telegram/webhook')
    .set('X-Telegram-Bot-Api-Secret-Token', secret)
    .send({ update_id: updateId, message: { message_id: updateId, chat, from: { id: from }, text } });
};

const reply = async (chat: Chat, from: number, text: string) =>
  (await send(chat, from, text).expect(200)).body.text as string;

const linkCode = async (agent: Agent, key: string, target: 'private' | 'group') => {
  const { body } = await agent.post(`/api/projects/${key}/telegram/link`).send({ target }).expect(200);
  const url = new URL(body.url as string);
  expect(url.pathname).toBe(`/${BOT}`);
  return url.searchParams.get(target === 'group' ? 'startgroup' : 'start')!;
};

const connect = async (agent: Agent, key: string, chat: Chat, from: number) => {
  const code = await linkCode(agent, key, chat.type === 'group' ? 'group' : 'private');
  const text = chat.type === 'group' ? `/start@${BOT} ${code}` : `/start ${code}`;
  expect(await reply(chat, from, text)).toContain(`Connected to <b>${key}</b>`);
};

const setupFamily = async () => {
  const parent = agentFor(app);
  const parentAccount = await registerUser(parent, { name: 'Dana Levi' });
  const project = await createHousehold(parent);
  const people: Record<string, { agent: Agent; id: string }> = {};
  for (const [name, systemKey] of [
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
    child: people['Mia Levi']!,
    sibling: people['Mike Levi']!,
    guest: people['Grandpa Joe']!,
  };
};

const listItems = async (agent: Agent) =>
  (
    (await agent.get('/api/projects/HOME/lists').expect(200)).body.lists as {
      id: string;
      name: string;
      items: { name: string; isChecked: boolean }[];
    }[]
  ).map((list) => ({
    id: list.id,
    name: list.name,
    items: list.items.map((item) => `${item.name}${item.isChecked ? ' ✓' : ''}`),
  }));

const tomorrow = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
};

beforeAll(() => {
  config.TELEGRAM_BOT_TOKEN = 'test-token';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ ok: true, result: { username: BOT } })),
  );
  app = testApp();
});

afterAll(() => {
  config.TELEGRAM_BOT_TOKEN = undefined;
  vi.unstubAllGlobals();
});

beforeEach(resetDb);

describe('Telegram webhook', () => {
  it('only accepts updates signed with the webhook secret', async () => {
    await send(GROUP, PARENT_TG, 'help', 'wrong-secret').expect(401);
    await request(app)
      .post('/telegram/webhook')
      .send({ message: { text: 'help' } })
      .expect(401);
    await send(GROUP, PARENT_TG, 'help').expect(200);
  });

  it('links private chats and groups with single-use codes', async () => {
    const parent = agentFor(app);
    await registerUser(parent);
    await createHousehold(parent);
    const code = await linkCode(parent, 'HOME', 'private');
    expect(await reply(GROUP, PARENT_TG, `/start@${BOT} ${code}`)).toBe(
      'Open this link in a private chat with me.',
    );
    expect(await reply(dm(PARENT_TG), PARENT_TG, `/start ${code}`)).toContain('expired');
    const groupCode = await linkCode(parent, 'HOME', 'group');
    expect(await reply(dm(PARENT_TG), PARENT_TG, `/start ${groupCode}`)).toBe(
      'Open this link to add me to a group.',
    );
    await connect(parent, 'HOME', dm(PARENT_TG), PARENT_TG);
    await connect(parent, 'HOME', GROUP, PARENT_TG);
    const { body } = await parent.get('/api/projects/HOME/telegram').expect(200);
    expect(body).toMatchObject({ enabled: true, allowed: true, botUsername: BOT, connected: true });
    expect(body.chats).toEqual([
      expect.objectContaining({ chatId: GROUP.id, title: 'Family', isGroup: true, canEdit: true }),
      expect.objectContaining({ chatId: PARENT_TG, isGroup: false, mine: true, onlyMine: true }),
    ]);
  });

  it('keeps and reads shopping lists', async () => {
    const { parent } = await setupFamily();
    expect(await reply(GROUP, PARENT_TG, 'apples, milk')).toBe('Added apples, milk to <b>Groceries</b>.');
    expect(await reply(GROUP, PARENT_TG, 'add hammer to hardware list')).toBe(
      'No list called "hardware". Lists: "Groceries"',
    );
    await parent.post('/api/projects/HOME/lists').send({ name: 'Hardware store' }).expect(201);
    expect(await reply(GROUP, PARENT_TG, 'add hammer and nails to the hardware store list')).toBe(
      'Added hammer, nails to <b>Hardware store</b>.',
    );
    expect(await reply(GROUP, PARENT_TG, '?')).toBe(
      '<b>Groceries</b>: apples, milk\n<b>Hardware store</b>: hammer, nails',
    );
    expect(await reply(GROUP, PARENT_TG, 'groceries?')).toBe('<b>Groceries</b>: apples, milk');
    expect(await reply(GROUP, PARENT_TG, 'apples?')).toBe(
      'No list called "apples". Lists: "Groceries", "Hardware store"',
    );
    expect(await reply(GROUP, PARENT_TG, 'i bought apple, nails and cheese')).toBe(
      'Ticked off apples, nails.\nNot on your lists: cheese.',
    );
    const lists = await listItems(parent);
    expect(lists.map((list) => list.items)).toEqual([
      ['milk', 'apples ✓'],
      ['hammer', 'nails ✓'],
    ]);
    expect(await reply(GROUP, PARENT_TG, 'open hardware store list page')).toBe(
      `<a href="${config.APP_URL}/p/HOME/shopping?list=${lists[1]!.id}">Open Hardware store</a>`,
    );
    expect(await reply(GROUP, PARENT_TG, 'open list page')).toBe(
      `<a href="${config.APP_URL}/p/HOME/shopping">Open the shopping lists</a>`,
    );
  });

  it('adds, lists and finishes chores', async () => {
    const { parent } = await setupFamily();
    expect(await reply(GROUP, PARENT_TG, 'chores?')).toBe('Nothing open. 🎉');
    expect(await reply(GROUP, PARENT_TG, 'mia needs to feed the cat tomorrow')).toMatch(
      /^Added <a href=".+\/t\/HOME-1">Feed the cat<\/a> for Mia Levi, due \w{3} \d+ \w{3}\.$/,
    );
    expect(await reply(GROUP, PARENT_TG, 'm needs to tidy up')).toBe('Who do you mean: Mia Levi, Mike Levi?');
    expect(await reply(GROUP, PARENT_TG, 'zed needs to tidy up')).toMatch(
      /^No one called "zed" here\. Members: /,
    );
    expect(await reply(GROUP, PARENT_TG, 'i need to call the plumber')).toMatch(/for Dana Levi\.$/);
    const { body } = await parent.get('/api/projects/HOME/tasks').expect(200);
    const feed = (body.items as { title: string; type: string; dueDate: string | null }[]).find(
      (task) => task.title === 'Feed the cat',
    );
    expect(feed).toMatchObject({ type: 'chore', dueDate: tomorrow() });

    const chores = await reply(GROUP, PARENT_TG, 'chores?');
    expect(chores.split('\n\n').map((block) => block.split('\n')[0])).toEqual([
      '<b>Dana Levi</b>',
      '<b>Mia Levi</b>',
    ]);
    expect(await reply(dm(PARENT_TG), PARENT_TG, 'mine?')).toContain('Call the plumber');
    expect(await reply(dm(PARENT_TG), PARENT_TG, 'mine?')).not.toContain('Feed the cat');
    expect(await reply(GROUP, PARENT_TG, 'home-1?')).toMatch(
      /^<b>HOME-1<\/b> .+Feed the cat.+\nTo do · Mia Levi · due /,
    );
    expect(await reply(GROUP, PARENT_TG, 'done home-1')).toMatch(/^Done: .+Feed the cat.+ ✅$/);
    expect(await reply(GROUP, PARENT_TG, 'home-1?')).toContain('\nDone · Mia Levi');
    expect(await reply(GROUP, PARENT_TG, 'home-99?')).toBe('Task not found');
  });

  it('shows the next appointments', async () => {
    const { parent } = await setupFamily();
    const startsAt = new Date(Date.now() + 2 * 86_400_000);
    startsAt.setUTCHours(9, 30, 0, 0);
    await parent
      .post('/api/calendar/events')
      .send({
        title: 'Dentist',
        location: 'Herzl 5',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
        projectKey: 'HOME',
        appointment: true,
        reminders: [60],
      })
      .expect(201);
    expect(await reply(GROUP, PARENT_TG, 'appointments?')).toMatch(
      /^• <b>Dentist<\/b> · .+09:30 · 45 min · Herzl 5$/,
    );
  });

  it('acts with the permissions of whoever sends the message', async () => {
    const { parent, child, guest } = await setupFamily();
    await child.agent.post('/api/projects/HOME/telegram/link').send({ target: 'group' }).expect(403);
    await connect(child.agent, 'HOME', dm(CHILD_TG), CHILD_TG);
    await connect(guest.agent, 'HOME', dm(GUEST_TG), GUEST_TG);
    expect(await reply(GROUP, CHILD_TG, 'apples')).toBe('Added apples to <b>Groceries</b>.');
    expect(await reply(GROUP, CHILD_TG, 'bought apples')).toBe('Ticked off apples.');
    expect(await reply(GROUP, CHILD_TG, 'dana needs to buy ice cream')).toBe(
      "Your role (Child) can't do that (missing permission: task.create)",
    );
    expect(await reply(GROUP, GUEST_TG, 'milk')).toMatch(/missing permission: lists\.edit/);
    expect((await listItems(parent))[0]!.items).toEqual(['apples ✓']);
  });

  it('answers unknown chats, unlinked senders and former members', async () => {
    const { parent, child } = await setupFamily();
    expect(await reply({ id: -999, type: 'group' }, PARENT_TG, 'apples')).toMatch(
      /^This chat is not connected yet/,
    );
    expect(await reply(GROUP, 999, 'apples')).toBe(
      'Connect your account first: MSR → Home → Settings → Telegram → Connect me.',
    );
    await connect(child.agent, 'HOME', dm(CHILD_TG), CHILD_TG);
    await parent.delete(`/api/projects/HOME/members/${child.id}`).expect(204);
    expect(await reply(GROUP, CHILD_TG, 'apples')).toBe('You are not a member of Home.');
    expect(await reply(dm(CHILD_TG), CHILD_TG, 'apples')).toBe('You are not a member of Home.');
  });

  it('follows the project owner’s plan', async () => {
    const { parent } = await setupFamily();
    await pool.query(
      "UPDATE subscriptions SET starts_at = now() - interval '2 days', expires_at = now() - interval '1 day'",
    );
    expect(await reply(GROUP, PARENT_TG, 'apples')).toBe(
      "This project's Telegram bot needs the Personal plan.",
    );
    await parent.post('/api/projects/HOME/telegram/link').send({ target: 'private' }).expect(402);

    const owner = agentFor(app);
    await registerUser(owner);
    await createProject(owner, { key: 'WEB' });
    await owner.post('/api/projects/WEB/telegram/link').send({ target: 'private' }).expect(402);
    await subscribe(owner, 'personal');
    const { body } = await owner.get('/api/projects/WEB/telegram').expect(200);
    expect(body).toMatchObject({ allowed: false, requiredPlan: 'pro' });
    await subscribe(owner, 'pro');
    await connect(owner, 'WEB', dm(404), 404);
    await pool.query("UPDATE subscriptions SET tier = 'personal' WHERE tier = 'pro'");
    expect(await reply(dm(404), 404, 'tasks?')).toBe("This project's Telegram bot needs the Pro plan.");
  });

  it('switches between the projects a chat follows', async () => {
    const parent = agentFor(app);
    await registerUser(parent);
    await subscribe(parent, 'pro');
    await createProject(parent, { key: 'HOME', name: 'Home', module: 'household' });
    await createProject(parent, { key: 'WEB' });
    await connect(parent, 'HOME', GROUP, PARENT_TG);
    await connect(parent, 'WEB', GROUP, PARENT_TG);
    expect(await reply(GROUP, PARENT_TG, 'apples')).toMatch(
      /^<b>What I understand<\/b>\n• <code>tasks\?<\/code>/,
    );
    expect(await reply(GROUP, PARENT_TG, 'use home')).toBe('Now working in <b>HOME</b>.');
    expect(await reply(GROUP, PARENT_TG, 'apples')).toBe('Added apples to <b>Groceries</b>.');
    expect(await reply(GROUP, PARENT_TG, 'use nope')).toBe('Project not found');
    const other = agentFor(app);
    await registerUser(other);
    await createProject(other, { key: 'SIDE' });
    expect(await reply(GROUP, PARENT_TG, 'use side')).toBe('Project not found');
    await createProject(parent, { key: 'MORE' });
    expect(await reply(GROUP, PARENT_TG, 'use more')).toBe(
      "This chat isn't connected to MORE. Connect it from that project's Settings → Telegram.",
    );
  });
});

describe('Telegram settings', () => {
  it('lets each person manage their own chats and project editors manage groups', async () => {
    const { parent, child } = await setupFamily();
    await connect(child.agent, 'HOME', dm(CHILD_TG), CHILD_TG);
    const { body } = await child.agent.get('/api/projects/HOME/telegram').expect(200);
    expect(body.chats).toEqual([
      expect.objectContaining({ chatId: GROUP.id, canEdit: false }),
      expect.objectContaining({ chatId: CHILD_TG, mine: true, canEdit: true }),
    ]);
    await child.agent
      .patch(`/api/projects/HOME/telegram/chats/${GROUP.id}`)
      .send({ notify: ['comments'] })
      .expect(403);
    await child.agent
      .patch(`/api/projects/HOME/telegram/chats/${PARENT_TG}`)
      .send({ onlyMine: false })
      .expect(404);
    const updated = await child.agent
      .patch(`/api/projects/HOME/telegram/chats/${CHILD_TG}`)
      .send({ notify: ['task_assigned', 'shopping_changes'], onlyMine: false })
      .expect(200);
    expect(updated.body.chat).toMatchObject({
      notify: ['task_assigned', 'shopping_changes'],
      onlyMine: false,
    });

    const lists = await listItems(parent);
    await parent.post('/api/projects/HOME/lists').send({ name: 'Pharmacy' }).expect(201);
    const pharmacy = (await listItems(parent)).find((list) => list.name === 'Pharmacy')!;
    await parent
      .patch(`/api/projects/HOME/telegram/chats/${GROUP.id}`)
      .send({ defaultListId: pharmacy.id })
      .expect(200);
    expect(await reply(GROUP, PARENT_TG, 'plasters')).toBe('Added plasters to <b>Pharmacy</b>.');
    await parent
      .patch(`/api/projects/HOME/telegram/chats/${GROUP.id}`)
      .send({ defaultListId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
    await parent
      .patch(`/api/projects/HOME/telegram/chats/${GROUP.id}`)
      .send({ defaultListId: null })
      .expect(200);
    expect(await reply(GROUP, PARENT_TG, 'bread')).toBe(`Added bread to <b>${lists[0]!.name}</b>.`);

    await parent.delete(`/api/projects/HOME/telegram/chats/${GROUP.id}`).expect(204);
    expect(await reply(GROUP, PARENT_TG, 'bread')).toMatch(/^This chat is not connected yet/);
    await child.agent.delete('/api/me/telegram').expect(204);
    expect((await child.agent.get('/api/projects/HOME/telegram').expect(200)).body).toMatchObject({
      connected: false,
      chats: [],
    });
    expect(await reply(dm(CHILD_TG), CHILD_TG, 'mine?')).toMatch(/^This chat is not connected yet/);
  });

  it('keeps household-only notifications to households', async () => {
    const owner = agentFor(app);
    await registerUser(owner);
    await subscribe(owner, 'pro');
    await createProject(owner, { key: 'WEB' });
    await connect(owner, 'WEB', dm(404), 404);
    await owner
      .patch('/api/projects/WEB/telegram/chats/404')
      .send({ notify: ['shopping_changes'] })
      .expect(400);
    await owner
      .patch('/api/projects/WEB/telegram/chats/404')
      .send({ notify: ['task_created', 'new_events'] })
      .expect(200);
    await owner.patch('/api/projects/WEB/telegram/chats/404').send({}).expect(400);
  });
});
