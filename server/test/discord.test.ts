import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { handleDiscordMessage, type DiscordMessage } from '../src/modules/bots/discord/messages';
import { runNotifications } from '../src/modules/bots/notifier';
import { agentFor, createHousehold, createTask, registerUser, resetDb, type Agent } from './helpers';
import {
  GROUP,
  PARENT_TG,
  connect as connectTelegram,
  sentMessages,
  startTelegram,
  stopTelegram,
  telegramApp,
  telegramFetch,
} from './telegramHelpers';

const BOT_ID = '900000000000000001';
const APP_ID = '900000000000000002';
const CHANNEL = '1234567890123456789';
const OTHER_CHANNEL = '1234567890123456790';
const DM = '1234567890123456700';
const GUILD = '1111111111111111111';
const DANA = '2222222222222222222';
const CONNECTED = 'Connected to **HOME**. Send `help` to see what I can do.';

const failures = new Map<string, Response[]>();
let posted: { channelId: string; content: string }[] = [];

const discordFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
  if (!String(url).startsWith('https://discord.com/')) return telegramFetch(String(url), init);
  const { pathname } = new URL(String(url));
  if (pathname.endsWith('/oauth2/applications/@me'))
    return Response.json({ id: APP_ID, bot: { id: BOT_ID, username: 'msr' } });
  if (pathname.endsWith(`/channels/${CHANNEL}`)) return Response.json({ name: 'family' });
  if (pathname.endsWith(`/guilds/${GUILD}`)) return Response.json({ name: 'Levi home' });
  const channelId = pathname.match(/\/channels\/(\d+)\/messages$/)?.[1];
  if (!channelId) return new Response(null, { status: 404 });
  posted.push({ channelId, content: (JSON.parse(String(init?.body)) as { content: string }).content });
  return failures.get(channelId)?.shift() ?? Response.json({ id: '1' });
});

const dmMessage = (content: string): DiscordMessage => ({
  channel_id: DM,
  content,
  author: { id: DANA, username: 'dana', global_name: 'Dana' },
});

const channelMessage = (content: string, mentioned = false, channel = CHANNEL): DiscordMessage => ({
  channel_id: channel,
  guild_id: GUILD,
  content,
  author: { id: DANA, username: 'dana' },
  mentions: mentioned ? [{ id: BOT_ID }] : [],
});

const say = async (message: DiscordMessage) => {
  posted = [];
  await handleDiscordMessage(message, BOT_ID);
  return posted.map((item) => item.content);
};

const linkCode = async (agent: Agent, target: 'private' | 'group') =>
  (await agent.post('/api/projects/HOME/bots/link').send({ platform: 'discord', target }).expect(200))
    .body as { platform: string; code: string; url: string };

const family = async () => {
  const parent = agentFor(telegramApp());
  await registerUser(parent, { name: 'Dana Levi' });
  await createHousehold(parent);
  const dmLink = await linkCode(parent, 'private');
  expect(dmLink).toMatchObject({ platform: 'discord', url: `https://discord.com/users/${BOT_ID}` });
  expect(await say(dmMessage(`start ${dmLink.code}`))).toEqual([CONNECTED]);
  const channelLink = await linkCode(parent, 'group');
  expect(channelLink.url).toBe(
    `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot&permissions=68608`,
  );
  expect(await say(channelMessage(`<@${BOT_ID}> start ${channelLink.code}`, true))).toEqual([CONNECTED]);
  return parent;
};

const notify = (agent: Agent, platform: string, chatId: string | number, kinds: string[]) =>
  agent.patch(`/api/projects/HOME/bots/chats/${platform}/${chatId}`).send({ notify: kinds }).expect(200);

const run = async () => {
  await pool.query("UPDATE task_activity SET created_at = created_at - interval '1 minute'");
  posted = [];
  await runNotifications();
  return posted;
};

beforeAll(() => {
  startTelegram();
  config.DISCORD_BOT_TOKEN = 'test-discord-token';
  vi.stubGlobal('fetch', discordFetch);
});

afterAll(() => {
  config.DISCORD_BOT_TOKEN = undefined;
  stopTelegram();
});

beforeEach(async () => {
  await resetDb();
  await pool.query('INSERT INTO bot_state (activity_cursor) VALUES (0)');
  failures.clear();
  posted = [];
  sentMessages();
});

describe('Discord bot', () => {
  it('links a DM and a server channel, then answers plain messages like Telegram', async () => {
    const parent = await family();
    const { body } = await parent.get('/api/projects/HOME/bots').expect(200);
    expect(body.platforms).toEqual([
      { platform: 'telegram', botName: 'msr_test_bot', connected: false },
      { platform: 'discord', botName: 'msr', connected: true },
    ]);
    expect(body.chats).toEqual([
      expect.objectContaining({
        platform: 'discord',
        chatId: CHANNEL,
        title: 'Levi home #family',
        isGroup: true,
      }),
      expect.objectContaining({ platform: 'discord', chatId: DM, title: 'Dana', isGroup: false, mine: true }),
    ]);

    expect(await say(channelMessage('apples, milk'))).toEqual(['Added apples, milk to **Groceries**.']);
    expect(await say(channelMessage('nice weather today', false, OTHER_CHANNEL))).toEqual([]);
    expect(await say(channelMessage(`<@${BOT_ID}> help`, true, OTHER_CHANNEL))).toEqual([
      'This chat is not connected yet. In MSR open a project → Settings → Bots.',
    ]);
    expect(
      await say({ ...channelMessage('apples'), author: { id: BOT_ID, username: 'msr', bot: true } }),
    ).toEqual([]);

    await createTask(parent, 'HOME', { title: 'Fix the gate' });
    const [chores] = await say(dmMessage('chores?'));
    expect(chores).toMatch(/^\*\*Anyone\*\*\n• \[Fix the gate\]\(<http.+\/t\/HOME-1>\)$/);
    const discussion = await createTask(parent, 'HOME', { title: 'Where do we go?', type: 'discussion' });
    expect(await say(channelMessage(`done ${discussion.identifier}`))).toEqual([
      `HOME\\-2 is a discussion. Close it with its decision: \`done HOME-2: what you decided\``,
    ]);
    expect((await say(channelMessage(`done ${discussion.identifier}: Crete in August`)))[0]).toMatch(
      /^Done: \[Where do we go\?\]\(<.+\/t\/HOME-2>\) ✅$/,
    );
  });

  it('sends one run of notifications to Telegram and Discord, each in its own format', async () => {
    const parent = await family();
    await connectTelegram(parent, 'HOME', GROUP, PARENT_TG);
    await notify(parent, 'discord', CHANNEL, ['task_created']);
    await notify(parent, 'telegram', GROUP.id, ['task_created']);
    await createTask(parent, 'HOME', { title: 'Fix the gate' });

    const messages = await run();
    expect(messages.map((message) => message.channelId)).toEqual([CHANNEL]);
    expect(messages[0]!.content).toMatch(
      /^\*\*HOME · Home\*\*\n🆕 \[HOME\\-1 Fix the gate\]\(<.+\/t\/HOME-1>\) \(Dana Levi\)$/,
    );
    const telegram = sentMessages();
    expect(telegram.map((message) => message.chatId)).toEqual([GROUP.id]);
    expect(telegram[0]!.text).toMatch(
      /^<b>HOME · Home<\/b>\n🆕 <a href=".+\/t\/HOME-1">HOME-1 Fix the gate<\/a>/,
    );
  });

  it('keeps a message under 2000 characters, retries a rate limit and drops channels it lost', async () => {
    const parent = await family();
    await notify(parent, 'discord', CHANNEL, ['task_created']);
    for (let index = 1; index <= 25; index += 1)
      await createTask(parent, 'HOME', {
        title: `Chore number ${index} ${'with a very long description '.repeat(4)}`,
      });
    const [busy] = await run();
    expect(busy!.content.length).toBeLessThanOrEqual(2000);
    expect(busy!.content).toMatch(/\n\n…and \d+ more in MSR$/);

    failures.set(CHANNEL, [Response.json({ retry_after: 0.01 }, { status: 429 })]);
    await createTask(parent, 'HOME', { title: 'Retried' });
    expect((await run()).map((message) => message.channelId)).toEqual([CHANNEL, CHANNEL]);

    failures.set(CHANNEL, [Response.json({ code: 50001 }, { status: 403 })]);
    await createTask(parent, 'HOME', { title: 'Lost' });
    await run();
    expect(
      (await pool.query("SELECT chat_id FROM bot_chats WHERE platform = 'discord' AND is_group")).rows,
    ).toEqual([]);
  });
});
