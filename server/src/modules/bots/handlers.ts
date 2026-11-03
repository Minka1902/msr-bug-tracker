import { BOT_PLATFORM_META, type BotPlatform } from '@msr/shared/bots';
import { addDays } from '@msr/shared/calendar';
import { formatIdentifier } from '@msr/shared/identifiers';
import { MODULE_META, PLAN_META, botAllowed, minimumBotPlan } from '@msr/shared/modules';
import { createItemSchema } from '@msr/shared/schemas/shopping';
import { createTaskSchema } from '@msr/shared/schemas/task';
import type { ShoppingItem, ShoppingList } from '@msr/shared/types';
import { HttpError, badRequest, notFound } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { listCalendarItems } from '../calendar/service';
import { loadRefs, resolveStatus } from '../connector/refs';
import { assertCanWrite, findProjectContext, type ProjectContext } from '../projects/access';
import { currentPlan } from '../shop/service';
import { addItems, checkItems, listLists } from '../shopping/service';
import { assertCanAssignOnCreate, assertCanPatchTask, findTaskByIdentifier } from '../tasks/access';
import { createTask, getTaskDetail, updateTask } from '../tasks/service';
import { DEFAULT_PREFERENCES, type UserRow } from '../users/service';
import { parseCommand, type Command, type When } from './commands';
import { formatDay, formatTime, localToday, type Formatter } from './format';
import { PLATFORMS } from './platforms';
import {
  consumeLinkCode,
  currentChat,
  findSender,
  linkChat,
  linkUser,
  openTasks,
  selectProject,
  statusName,
  type ChatRef,
  type ChatRow,
} from './service';

export interface BotMessage {
  platform: BotPlatform;
  chatId: string;
  isGroup: boolean;
  senderId: string;
  text: string;
  title: () => Promise<string>;
  quietWhenUnlinked?: boolean;
}

interface Context {
  chat: ChatRow;
  project: ProjectContext;
  sender: UserRow;
  timezone: string;
  f: Formatter;
}

const APPOINTMENT_DAYS = 14;
const TASKS_LIMIT = 60;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const pluralsOf = (word: string) => {
  const lower = word.trim().toLowerCase();
  return [`${lower}s`, `${lower}es`, `${lower.replace(/y$/, '')}ies`];
};

const singularOrPlural = (a: string, b: string) =>
  pluralsOf(a).includes(b.trim().toLowerCase()) || pluralsOf(b).includes(a.trim().toLowerCase());

const realDate = (day: string) =>
  !Number.isNaN(Date.parse(day)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);

const dueDateOf = (when: When | null, timezone: string) => {
  if (!when) return null;
  const today = localToday(timezone);
  if (when.kind === 'today') return today;
  if (when.kind === 'tomorrow') return addDays(today, 1);
  if (when.kind === 'weekday') {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    return addDays(today, (when.day - weekday + 7) % 7);
  }
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(when.month).padStart(2, '0')}-${String(when.day).padStart(2, '0')}`;
  const day = candidate < today ? `${year + 1}${candidate.slice(4)}` : candidate;
  if (!realDate(day)) throw badRequest('That date does not exist');
  return day;
};

const listNames = (f: Formatter, lists: ShoppingList[]) =>
  lists.map((list) => `"${f.text(list.name)}"`).join(', ');

const describeList = (f: Formatter, list: ShoppingList) => {
  const open = list.items.filter((item) => !item.isChecked);
  return `${f.bold(list.name)}: ${
    open.length
      ? open.map((item) => f.text(item.quantity ? `${item.name} (${item.quantity})` : item.name)).join(', ')
      : 'nothing to buy'
  }`;
};

export const helpText = (f: Formatter, household: boolean) =>
  [
    f.bold('What I understand'),
    ...(household
      ? [
          `• ${f.code('apples, milk')} or ${f.code('add apples to store list')}: add to a shopping list`,
          `• ${f.code('i bought apples and cheese')}: tick them off`,
          `• ${f.code('?')} or ${f.code('groceries?')}: what is on the lists`,
          `• ${f.code('open groceries list page')}: a link to a list`,
          `• ${f.code('appointments?')}: the next two weeks`,
        ]
      : []),
    `• ${f.code(household ? 'chores?' : 'tasks?')} / ${f.code('mine?')}: open work by person / yours`,
    `• ${f.code('michael needs to wash the car today')}: add a task for someone`,
    `• ${f.code('KEY-12?')} / ${f.code('done KEY-12')}: look up or finish a task`,
    `• ${f.code('done KEY-12: we chose X')}: close a discussion with its decision`,
    `• ${f.code('open project page')} · ${f.code('use KEY')}: switch project`,
  ].join('\n');

const householdOnly = (context: Context) => {
  if (context.project.module !== 'household') throw badRequest(helpText(context.f, false));
};

const pickList = (f: Formatter, lists: ShoppingList[], name: string | null, chat: ChatRow) => {
  const list = name
    ? lists.find((item) => same(item.name, name) || same(item.name, `${name} list`))
    : (lists.find((item) => item.id === chat.default_list_id) ?? lists[0]);
  if (!list)
    throw badRequest(
      lists.length
        ? `No list called "${f.text(name!)}". Lists: ${listNames(f, lists)}`
        : 'This household has no shopping lists yet',
    );
  return list;
};

const addToList = async (context: Context, items: string[], listName: string | null) => {
  const { f } = context;
  householdOnly(context);
  if (!items.length) return helpText(f, true);
  assertCanWrite(context.project, 'lists.edit');
  const list = pickList(f, await listLists(context.project.id), listName, context.chat);
  await addItems(
    list.id,
    items.map((name) => createItemSchema.parse({ name })),
    context.sender.id,
    { platform: context.chat.platform, chatId: context.chat.chat_id },
  );
  return `Added ${items.map(f.text).join(', ')} to ${f.bold(list.name)}.`;
};

const tickItems = async (context: Context, items: string[]) => {
  const { f } = context;
  householdOnly(context);
  assertCanWrite(context.project, 'lists.edit');
  const open = (await listLists(context.project.id)).flatMap((list) =>
    list.items.filter((item) => !item.isChecked),
  );
  const ticked: ShoppingItem[] = [];
  const missing: string[] = [];
  for (const name of items) {
    const match =
      open.find((item) => same(item.name, name)) ?? open.find((item) => singularOrPlural(item.name, name));
    if (!match) {
      missing.push(name);
      continue;
    }
    open.splice(open.indexOf(match), 1);
    ticked.push(match);
  }
  if (ticked.length)
    await checkItems(
      context.project.id,
      ticked.map((item) => item.id),
      true,
      context.sender.id,
    );
  return [
    ticked.length && `Ticked off ${ticked.map((item) => f.text(item.name)).join(', ')}.`,
    missing.length && `Not on your lists: ${missing.map(f.text).join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
};

const showList = async (context: Context, name: string) => {
  const { f } = context;
  householdOnly(context);
  const lists = await listLists(context.project.id);
  const list = lists.find((item) => same(item.name, name));
  if (!list) return `No list called "${f.text(name)}". Lists: ${listNames(f, lists)}`;
  return describeList(f, list);
};

const viewerOf = (context: Context) => (context.chat.is_group ? null : context.sender.id);

const findVisibleTask = async (context: Context, identifier: string) => {
  const found = await findTaskByIdentifier(identifier, context.sender.id);
  if (context.chat.is_group && found.task.cardType?.restricted) throw notFound('Task not found');
  return found;
};

const showTasks = async (context: Context, mine: boolean) => {
  const { f } = context;
  const rows = await openTasks(
    context.project.id,
    mine ? context.sender.id : null,
    TASKS_LIMIT,
    viewerOf(context),
  );
  if (!rows.length) return mine ? 'Nothing open for you. 🎉' : 'Nothing open. 🎉';
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const who = row.assignee ?? 'Anyone';
    const line = `• ${f.link(`/t/${formatIdentifier(context.chat.key, row.number)}`, row.title)}${
      row.due_date ? ` · ${formatDay(row.due_date, context.timezone)}` : ''
    }`;
    groups.set(who, [...(groups.get(who) ?? []), line]);
  }
  return [...groups].map(([who, lines]) => `${f.bold(who)}\n${lines.join('\n')}`).join('\n\n');
};

const showTask = async (context: Context, identifier: string) => {
  const { f } = context;
  const { task } = await findVisibleTask(context, identifier);
  const detail = await getTaskDetail(task.id);
  return [
    `${f.bold(detail.identifier)} ${f.link(`/t/${detail.identifier}`, detail.title)}`,
    `${f.text((await statusName(detail.statusId)) ?? detail.statusCategory)} · ${f.text(detail.assignee?.name ?? 'Anyone')}${
      detail.dueDate ? ` · due ${formatDay(detail.dueDate, context.timezone)}` : ''
    }`,
  ].join('\n');
};

const finishTask = async (context: Context, identifier: string, decision: string | null) => {
  const { f } = context;
  const { project, task } = await findVisibleTask(context, identifier);
  const detail = await getTaskDetail(task.id);
  if (detail.type === 'discussion' && !decision && !detail.decision.trim())
    return `${f.text(detail.identifier)} is a discussion. Close it with its decision: ${f.code(`done ${detail.identifier}: what you decided`)}`;
  const patch = {
    statusId: resolveStatus(await loadRefs(project.id), 'done', detail.type),
    ...(detail.type === 'discussion' && decision && { decision }),
  };
  assertCanPatchTask(project, task, patch, context.sender.id);
  await updateTask(project, task.id, patch, context.sender.id);
  return `Done: ${f.link(`/t/${detail.identifier}`, detail.title)} ✅`;
};

const assignTask = async (context: Context, command: Extract<Command, { kind: 'assign' }>) => {
  const { f } = context;
  assertCanWrite(context.project, 'task.create');
  const refs = await loadRefs(context.project.id);
  const wanted = command.person.toLowerCase();
  const matches = ['i', 'me'].includes(wanted)
    ? refs.members.filter((member) => member.id === context.sender.id)
    : refs.members.filter((member) => member.name.toLowerCase().startsWith(wanted));
  if (!matches.length)
    return `No one called "${f.text(command.person)}" here. Members: ${refs.members.map((member) => f.text(member.name)).join(', ')}`;
  if (matches.length > 1)
    return `Who do you mean: ${matches.map((member) => f.text(member.name)).join(', ')}?`;
  const assignee = matches[0]!;
  const input = createTaskSchema.parse({
    title: command.title,
    type: MODULE_META[context.project.module].taskTypes[0],
    assigneeId: assignee.id,
    dueDate: dueDateOf(command.when, context.timezone),
  });
  assertCanAssignOnCreate(context.project, input.assigneeId, context.sender.id);
  const task = await createTask(context.project, input, context.sender.id);
  return `Added ${f.link(`/t/${task.identifier}`, task.title)} for ${f.text(assignee.name)}${
    task.dueDate ? `, due ${formatDay(task.dueDate, context.timezone)}` : ''
  }.`;
};

const showAppointments = async (context: Context) => {
  const { f } = context;
  householdOnly(context);
  const today = localToday(context.timezone);
  const items = (
    await listCalendarItems(
      context.sender.id,
      today,
      addDays(today, APPOINTMENT_DAYS - 1),
      context.project.id,
      false,
    )
  ).filter((item) => item.appointment && Date.parse(item.endsAt) > Date.now());
  if (!items.length) return 'No appointments in the next two weeks.';
  return items
    .map((item) => {
      const minutes = Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000);
      return `• ${f.bold(item.title)} · ${formatTime(item.startsAt, context.timezone)} · ${minutes} min${
        item.location ? ` · ${f.text(item.location)}` : ''
      }`;
    })
    .join('\n');
};

const switchProject = async (context: Context, key: string) => {
  const { f } = context;
  const project = await findProjectContext(key, context.sender.id);
  if (!(await selectProject({ platform: context.chat.platform, chatId: context.chat.chat_id }, project.key)))
    return `This chat isn't connected to ${f.text(key)}. Connect it from that project's Settings → Bots.`;
  return `Now working in ${f.bold(project.key)}.`;
};

const run = (context: Context, command: Command): Promise<string> | string => {
  const { f } = context;
  switch (command.kind) {
    case 'help':
    case 'start':
      return helpText(f, context.project.module === 'household');
    case 'use':
      return switchProject(context, command.key);
    case 'add':
      return addToList(context, command.items, command.list);
    case 'bought':
      return tickItems(context, command.items);
    case 'lists':
      householdOnly(context);
      return listLists(context.project.id).then(
        (lists) => lists.map((list) => describeList(f, list)).join('\n') || 'No lists yet.',
      );
    case 'list':
      return showList(context, command.name);
    case 'open_list':
      householdOnly(context);
      return command.name
        ? listLists(context.project.id).then((lists) => {
            const list = pickList(f, lists, command.name, context.chat);
            return f.link(`/p/${context.chat.key}/shopping?list=${list.id}`, `Open ${list.name}`);
          })
        : f.link(`/p/${context.chat.key}/shopping`, 'Open the shopping lists');
    case 'open_project':
      return f.link(`/p/${context.chat.key}`, `Open ${context.chat.name}`);
    case 'tasks':
    case 'mine':
      return showTasks(context, command.kind === 'mine');
    case 'task':
      return showTask(context, command.identifier);
    case 'done':
      return finishTask(context, command.identifier, command.decision);
    case 'assign':
      return assignTask(context, command);
    case 'appointments':
      return showAppointments(context);
  }
};

const linkWithCode = async (message: BotMessage, f: Formatter, code: string) => {
  const linked = await consumeLinkCode(message.platform, code);
  const where = BOT_PLATFORM_META[message.platform].groupLabel;
  if (!linked) return 'This code has expired. In MSR open the project → Settings → Bots and try again.';
  if (linked.is_group !== message.isGroup)
    return linked.is_group
      ? `Use this code in the ${where} you want to connect.`
      : 'Use this code in a private chat with me.';
  const project = await findProjectContext(linked.key, linked.user_id).catch(() => null);
  if (!project) return 'You are no longer a member of that project.';
  const chat: ChatRef = { platform: message.platform, chatId: message.chatId };
  await linkUser(message.platform, message.senderId, linked.user_id);
  await linkChat(chat, project.id, await message.title(), message.isGroup, linked.user_id);
  return `Connected to ${f.bold(project.key)}. Send ${f.code('help')} to see what I can do.`;
};

export const handleMessage = async (message: BotMessage): Promise<string | null> => {
  const text = message.text.trim();
  if (!text) return null;
  const f = PLATFORMS[message.platform].format;
  const command = parseCommand(text);
  try {
    if (command.kind === 'start') return await linkWithCode(message, f, command.code);
    const chat = await currentChat({ platform: message.platform, chatId: message.chatId });
    if (!chat)
      return message.quietWhenUnlinked
        ? null
        : 'This chat is not connected yet. In MSR open a project → Settings → Bots.';
    const sender = await findSender(message.platform, message.senderId);
    if (!sender)
      return `Connect your account first: MSR → ${f.text(chat.name)} → Settings → Bots → Connect me.`;
    const project = await findProjectContext(chat.key, sender.id).catch(() => null);
    if (!project) return `You are not a member of ${f.text(chat.name)}.`;
    const { tier } = await currentPlan(chat.owner_id);
    if (!botAllowed(tier, project.module))
      return `This project's ${BOT_PLATFORM_META[message.platform].label} bot needs the ${PLAN_META[minimumBotPlan(project.module)].label} plan.`;
    const timezone = sender.preferences.timezone ?? DEFAULT_PREFERENCES.timezone;
    return await run({ chat, project, sender, timezone, f }, command);
  } catch (error) {
    if (error instanceof HttpError) {
      const missing = (error.details as { missing?: string[] } | undefined)?.missing;
      return missing ? `${error.message} (missing permission: ${missing.join(', ')})` : error.message;
    }
    logger.error({ err: error, platform: message.platform }, 'Bot command failed');
    return 'Something went wrong. Try again in a moment.';
  }
};
