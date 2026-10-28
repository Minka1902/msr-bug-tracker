import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { runNotifications } from '../src/modules/telegram/notifier';
import { createTask, resetDb, statusOf, type Agent } from './helpers';
import {
  CHILD_TG,
  GROUP,
  OTHER_PARENT_TG,
  PARENT_TG,
  connect,
  dm,
  postUpdate,
  reply,
  sentMessages,
  setupFamily,
  startTelegram,
  stopTelegram,
  telegramFailures,
} from './telegramHelpers';

const SIBLING_TG = 505;

const notifyChat = (agent: Agent, chatId: number, patch: Record<string, unknown>) =>
  agent.patch(`/api/projects/HOME/telegram/chats/${chatId}`).send(patch).expect(200);

const run = async () => {
  await pool.query("UPDATE task_activity SET created_at = created_at - interval '1 minute'");
  await runNotifications();
  return sentMessages();
};

const textFor = (messages: { chatId: number; text: string }[], chatId: number) =>
  messages.filter((message) => message.chatId === chatId).map((message) => message.text);

const localDay = (timezone: string, offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

const zoneAt = (hour: number) => {
  let offset = hour - new Date().getUTCHours();
  if (offset < -12) offset += 24;
  if (offset > 14) offset -= 24;
  return offset >= 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
};

const appointment = (agent: Agent, minutesAhead: number, overrides: Record<string, unknown> = {}) => {
  const startsAt = new Date(Date.now() + minutesAhead * 60_000);
  return agent
    .post('/api/calendar/events')
    .send({
      title: 'Dentist',
      location: 'Herzl 5',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
      projectKey: 'HOME',
      appointment: true,
      reminders: [60],
      ...overrides,
    })
    .expect(201)
    .then((response) => response.body.event as { id: string });
};

beforeAll(startTelegram);
afterAll(stopTelegram);

beforeEach(async () => {
  await resetDb();
  await pool.query('INSERT INTO telegram_state (activity_cursor) VALUES (0)');
  telegramFailures.clear();
  sentMessages();
});

describe('Telegram notifications', () => {
  it('sends each chat one message with only the kinds it picked, and never twice', async () => {
    const { parent, otherParent, project } = await setupFamily();
    await connect(otherParent.agent, 'HOME', dm(OTHER_PARENT_TG), OTHER_PARENT_TG);
    await notifyChat(parent, GROUP.id, {
      notify: [
        'task_created',
        'task_assigned',
        'status_changed',
        'comments',
        'priority_raised',
        'shopping_changes',
        'new_events',
      ],
    });
    await notifyChat(parent, PARENT_TG, { notify: ['task_created', 'comments'], onlyMine: false });
    await notifyChat(otherParent.agent, OTHER_PARENT_TG, { notify: ['task_assigned', 'comments'] });

    const task = await createTask(parent, 'HOME', { title: 'Fix the gate', priority: 'medium' });
    await parent.patch(`/api/tasks/${task.id}`).send({ assigneeId: otherParent.id }).expect(200);
    await parent.patch(`/api/tasks/${task.id}`).send({ priority: 'urgent' }).expect(200);
    await parent.patch(`/api/tasks/${task.id}`).send({ priority: 'low' }).expect(200);
    await parent
      .patch(`/api/tasks/${task.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(200);
    await otherParent.agent
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: 'Done, new hinge.' })
      .expect(201);
    const [groceries] = (await parent.get('/api/projects/HOME/lists').expect(200)).body.lists;
    await parent.post(`/api/projects/HOME/lists/${groceries.id}/items`).send({ name: 'hinge' }).expect(201);
    await appointment(parent, 3 * 24 * 60, { reminders: [] });

    const messages = await run();
    expect(messages.map((message) => message.chatId).sort()).toEqual(
      [GROUP.id, PARENT_TG, OTHER_PARENT_TG].sort(),
    );
    const [group] = textFor(messages, GROUP.id);
    expect(group!.split('\n')).toEqual([
      '<b>HOME · Home</b>',
      expect.stringMatching(/^🆕 <a href=".+\/t\/HOME-1">HOME-1 Fix the gate<\/a> for Avi Levi \(Dana Levi\)$/),
      expect.stringMatching(/^👤 .+HOME-1 Fix the gate.+ → Avi Levi \(Dana Levi\)$/),
      expect.stringMatching(/^⬆️ .+: medium → urgent \(Dana Levi\)$/),
      expect.stringMatching(/^🔄 .+: To do → Done \(Dana Levi\)$/),
      expect.stringMatching(/^💬 Avi Levi commented on .+HOME-1 Fix the gate/),
      '🛒 Dana Levi added hinge to Groceries',
      expect.stringMatching(/^📅 Dana Levi added an appointment: <b>Dentist<\/b> · .+ · Herzl 5$/),
    ]);
    expect(textFor(messages, PARENT_TG)).toEqual([
      expect.stringMatching(/^<b>HOME · Home<\/b>\n💬 Avi Levi commented on /),
    ]);
    expect(textFor(messages, OTHER_PARENT_TG)).toEqual([
      expect.stringMatching(/^<b>HOME · Home<\/b>\n👤 .+ → Avi Levi \(Dana Levi\)$/),
    ]);
    expect(await run()).toEqual([]);
  });

  it('keeps "only my tasks" chats to their own tasks and does not echo bot changes', async () => {
    const { parent, otherParent, child } = await setupFamily();
    await connect(otherParent.agent, 'HOME', dm(OTHER_PARENT_TG), OTHER_PARENT_TG);
    await notifyChat(parent, GROUP.id, { notify: ['shopping_changes'] });
    await notifyChat(otherParent.agent, OTHER_PARENT_TG, { notify: ['task_created', 'shopping_changes'] });

    expect(await reply(GROUP, PARENT_TG, 'apples')).toBe('Added apples to <b>Groceries</b>.');
    await createTask(parent, 'HOME', { title: 'For Mia', assigneeId: child.id });
    await createTask(parent, 'HOME', { title: 'For Avi', assigneeId: otherParent.id });
    const messages = await run();
    expect(textFor(messages, GROUP.id)).toEqual([]);
    expect(textFor(messages, OTHER_PARENT_TG)).toEqual([
      expect.stringMatching(/^<b>HOME · Home<\/b>\n🆕 .+For Avi.+\n🛒 Dana Levi added apples to Groceries$/),
    ]);

    await notifyChat(otherParent.agent, OTHER_PARENT_TG, { onlyMine: false });
    await createTask(parent, 'HOME', { title: 'For Mia again', assigneeId: child.id });
    expect(textFor(await run(), OTHER_PARENT_TG)).toEqual([expect.stringContaining('For Mia again')]);
  });

  it('sends the daily digest once a local day from 08:00', async () => {
    const { parent, parentId, child, project } = await setupFamily();
    await notifyChat(parent, PARENT_TG, { notify: ['daily_digest'], onlyMine: false });
    await notifyChat(parent, GROUP.id, { notify: [] });
    const early = zoneAt(3);
    await pool.query(
      `UPDATE users SET preferences = preferences || jsonb_build_object('timezone', $2::text) WHERE id = $1`,
      [parentId, early],
    );
    await createTask(parent, 'HOME', { title: 'Due today', assigneeId: child.id, dueDate: localDay(early) });
    expect(await run()).toEqual([]);

    const late = zoneAt(12);
    await pool.query(
      `UPDATE users SET preferences = preferences || jsonb_build_object('timezone', $2::text) WHERE id = $1`,
      [parentId, late],
    );
    await pool.query('UPDATE tasks SET due_date = $1', [localDay(late)]);
    await createTask(parent, 'HOME', { title: 'Late', dueDate: localDay(late, -2) });
    await createTask(parent, 'HOME', { title: 'Tomorrow', dueDate: localDay(late, 1) });
    const done = await createTask(parent, 'HOME', { title: 'Finished', dueDate: localDay(late) });
    await parent
      .patch(`/api/tasks/${done.id}`)
      .send({ statusId: statusOf(project, 'task', 'Done') })
      .expect(200);

    const [digest] = textFor(await run(), PARENT_TG);
    expect(digest!.split('\n')).toEqual([
      '<b>HOME · Home</b>',
      '☀️ <b>Due today</b>',
      expect.stringMatching(/HOME-1 Due today<\/a> · Mia Levi$/),
      expect.stringMatching(/HOME-2 Late<\/a> · Anyone · overdue since /),
    ]);
    expect(await run()).toEqual([]);
    await pool.query('UPDATE telegram_chats SET digest_sent_on = digest_sent_on - 1');
    expect(textFor(await run(), PARENT_TG)).toHaveLength(1);
  });

  it('alerts once when a task becomes overdue, and again after its due date moves', async () => {
    const { parent } = await setupFamily();
    await notifyChat(parent, GROUP.id, { notify: ['overdue'] });
    const task = await createTask(parent, 'HOME', { title: 'Renew passport', dueDate: localDay('UTC', -1) });
    await createTask(parent, 'HOME', { title: 'Not yet', dueDate: localDay('UTC') });
    expect(textFor(await run(), GROUP.id)).toEqual([
      expect.stringMatching(/^<b>HOME · Home<\/b>\n⏰ .+HOME-1 Renew passport<\/a> was due \w{3} \d+ \w{3}$/),
    ]);
    expect(await run()).toEqual([]);
    await parent
      .patch(`/api/tasks/${task.id}`)
      .send({ dueDate: localDay('UTC', -2) })
      .expect(200);
    expect(textFor(await run(), GROUP.id)).toHaveLength(1);
  });

  it('reminds attendees once, with only the closest reminder, and again after a move', async () => {
    const { parent, child, sibling } = await setupFamily();
    await connect(child.agent, 'HOME', dm(CHILD_TG), CHILD_TG);
    await connect(sibling.agent, 'HOME', dm(SIBLING_TG), SIBLING_TG);
    await appointment(parent, 30, { title: 'Orthodontist', attendeeIds: [child.id] });
    let messages = await run();
    for (const chatId of [GROUP.id, CHILD_TG])
      expect(textFor(messages, chatId)).toEqual([
        expect.stringMatching(/^<b>HOME · Home<\/b>\n⏰ <b>Orthodontist<\/b> in 30 min · .+ · Herzl 5$/),
      ]);
    expect(textFor(messages, SIBLING_TG)).toEqual([]);
    expect(textFor(messages, PARENT_TG)).toEqual([]);

    await notifyChat(parent, PARENT_TG, { onlyMine: false });
    const event = await appointment(parent, 20, { reminders: [1440, 60] });
    messages = await run();
    expect(textFor(messages, SIBLING_TG)).toEqual([expect.stringContaining('<b>Dentist</b> in 20 min')]);
    expect(messages).toHaveLength(4);
    expect(await run()).toEqual([]);
    const startsAt = new Date(Date.now() + 50 * 60_000);
    await parent
      .patch(`/api/calendar/events/${event.id}`)
      .send({
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
      })
      .expect(200);
    expect(textFor(await run(), GROUP.id)).toEqual([expect.stringContaining('<b>Dentist</b> in 50 min')]);
  });

  it('stays quiet when the plan lapses, drops chats that blocked the bot and follows group upgrades', async () => {
    const { parent } = await setupFamily();
    await notifyChat(parent, GROUP.id, { notify: ['task_created'] });
    await notifyChat(parent, PARENT_TG, { notify: ['comments'] });
    await pool.query(
      "UPDATE subscriptions SET starts_at = now() - interval '2 days', expires_at = now() - interval '1 day'",
    );
    await createTask(parent, 'HOME', { title: 'Quiet' });
    expect(await run()).toEqual([]);
    await pool.query("UPDATE subscriptions SET expires_at = now() + interval '1 year'");

    telegramFailures.set(
      GROUP.id,
      Response.json(
        {
          ok: false,
          error_code: 400,
          description: 'group upgraded',
          parameters: { migrate_to_chat_id: -100500 },
        },
        { status: 400 },
      ),
    );
    await createTask(parent, 'HOME', { title: 'Loud' });
    const messages = await run();
    expect(messages.map((message) => message.chatId)).toEqual([GROUP.id, -100500]);
    expect((await pool.query('SELECT chat_id FROM telegram_chats WHERE NOT is_group')).rows).toEqual([
      { chat_id: PARENT_TG },
    ]);
    expect((await pool.query('SELECT chat_id FROM telegram_chats WHERE is_group')).rows).toEqual([
      { chat_id: -100500 },
    ]);

    telegramFailures.set(
      -100500,
      Response.json({ ok: false, error_code: 403, description: 'kicked' }, { status: 403 }),
    );
    await createTask(parent, 'HOME', { title: 'Kicked' });
    await run();
    expect((await pool.query('SELECT chat_id FROM telegram_chats WHERE is_group')).rows).toEqual([]);
  });

  it('caps a busy run at one short message per chat', async () => {
    const { parent } = await setupFamily();
    await notifyChat(parent, GROUP.id, { notify: ['task_created'] });
    for (let index = 0; index < 35; index += 1)
      await createTask(parent, 'HOME', { title: `Chore ${index + 1}` });
    const messages = await run();
    expect(messages).toHaveLength(1);
    const lines = messages[0]!.text.split('\n');
    expect(lines).toHaveLength(1 + 30 + 2);
    expect(lines.at(-1)).toBe('…and 5 more in MSR');
  });

  it('moves a chat when Telegram upgrades its group', async () => {
    const { parent } = await setupFamily();
    await pool.query("UPDATE telegram_chats SET notify = '{task_created}'");
    await postUpdate({ chat: GROUP, migrate_to_chat_id: -100777 }).expect(200);
    await createTask(parent, 'HOME', { title: 'Moved' });
    expect((await run()).map((message) => message.chatId)).toEqual([-100777]);
  });
});
