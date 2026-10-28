import { addDays } from '@msr/shared/calendar';
import { formatIdentifier } from '@msr/shared/identifiers';
import { MODULE_META, PLAN_META, botAllowed, minimumBotPlan } from '@msr/shared/modules';
import { createItemSchema } from '@msr/shared/schemas/shopping';
import { createTaskSchema } from '@msr/shared/schemas/task';
import type { ShoppingItem, ShoppingList } from '@msr/shared/types';
import { HttpError, badRequest } from '../../lib/httpError';
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
import { escape, formatDay, formatTime, link, localToday } from './format';
import {
  consumeLinkCode,
  currentChat,
  findSender,
  linkChat,
  linkUser,
  migrateChat,
  openTasks,
  selectProject,
  statusName,
  type ChatRow,
} from './service';

export interface TelegramMessage {
  text?: string;
  migrate_to_chat_id?: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; first_name?: string };
}

interface Context {
  chat: ChatRow;
  project: ProjectContext;
  sender: UserRow;
  timezone: string;
}

const APPOINTMENT_DAYS = 14;
const TASKS_LIMIT = 60;
const GROUP_TYPES = new Set(['group', 'supergroup']);

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

const listNames = (lists: ShoppingList[]) => lists.map((list) => `"${escape(list.name)}"`).join(', ');

const describeList = (list: ShoppingList) => {
  const open = list.items.filter((item) => !item.isChecked);
  return `<b>${escape(list.name)}</b>: ${
    open.length
      ? open.map((item) => escape(item.quantity ? `${item.name} (${item.quantity})` : item.name)).join(', ')
      : 'nothing to buy'
  }`;
};

const helpText = (household: boolean) =>
  [
    '<b>What I understand</b>',
    ...(household
      ? [
          '• <code>apples, milk</code> or <code>add apples to store list</code>: add to a shopping list',
          '• <code>i bought apples and cheese</code>: tick them off',
          '• <code>?</code> or <code>groceries?</code>: what is on the lists',
          '• <code>open groceries list page</code>: a link to a list',
          '• <code>appointments?</code>: the next two weeks',
        ]
      : []),
    `• <code>${household ? 'chores?' : 'tasks?'}</code> / <code>mine?</code>: open work by person / yours`,
    '• <code>michael needs to wash the car today</code>: add a task for someone',
    '• <code>KEY-12?</code> / <code>done KEY-12</code>: look up or finish a task',
    '• <code>open project page</code> · <code>use KEY</code>: switch project',
  ].join('\n');

const householdOnly = (context: Context) => {
  if (context.project.module !== 'household') throw badRequest(helpText(false));
};

const pickList = (lists: ShoppingList[], name: string | null, chat: ChatRow) => {
  const list = name
    ? lists.find((item) => same(item.name, name) || same(item.name, `${name} list`))
    : (lists.find((item) => item.id === chat.default_list_id) ?? lists[0]);
  if (!list)
    throw badRequest(
      lists.length
        ? `No list called "${escape(name!)}". Lists: ${listNames(lists)}`
        : 'This household has no shopping lists yet',
    );
  return list;
};

const addToList = async (context: Context, items: string[], listName: string | null) => {
  householdOnly(context);
  if (!items.length) return helpText(true);
  assertCanWrite(context.project, 'lists.edit');
  const list = pickList(await listLists(context.project.id), listName, context.chat);
  await addItems(
    list.id,
    items.map((name) => createItemSchema.parse({ name })),
    context.sender.id,
    context.chat.chat_id,
  );
  return `Added ${items.map(escape).join(', ')} to <b>${escape(list.name)}</b>.`;
};

const tickItems = async (context: Context, items: string[]) => {
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
    ticked.length && `Ticked off ${ticked.map((item) => escape(item.name)).join(', ')}.`,
    missing.length && `Not on your lists: ${missing.map(escape).join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
};

const showList = async (context: Context, name: string) => {
  householdOnly(context);
  const lists = await listLists(context.project.id);
  const list = lists.find((item) => same(item.name, name));
  if (!list) return `No list called "${escape(name)}". Lists: ${listNames(lists)}`;
  return describeList(list);
};

const showTasks = async (context: Context, mine: boolean) => {
  const rows = await openTasks(context.project.id, mine ? context.sender.id : null, TASKS_LIMIT);
  if (!rows.length) return mine ? 'Nothing open for you. 🎉' : 'Nothing open. 🎉';
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const who = row.assignee ?? 'Anyone';
    const line = `• ${link(`/t/${formatIdentifier(context.chat.key, row.number)}`, row.title)}${
      row.due_date ? ` · ${formatDay(row.due_date, context.timezone)}` : ''
    }`;
    groups.set(who, [...(groups.get(who) ?? []), line]);
  }
  return [...groups].map(([who, lines]) => `<b>${escape(who)}</b>\n${lines.join('\n')}`).join('\n\n');
};

const showTask = async (context: Context, identifier: string) => {
  const { task } = await findTaskByIdentifier(identifier, context.sender.id);
  const detail = await getTaskDetail(task.id);
  return [
    `<b>${escape(detail.identifier)}</b> ${link(`/t/${detail.identifier}`, detail.title)}`,
    `${escape((await statusName(detail.statusId)) ?? detail.statusCategory)} · ${escape(detail.assignee?.name ?? 'Anyone')}${
      detail.dueDate ? ` · due ${formatDay(detail.dueDate, context.timezone)}` : ''
    }`,
  ].join('\n');
};

const finishTask = async (context: Context, identifier: string) => {
  const { project, task } = await findTaskByIdentifier(identifier, context.sender.id);
  const detail = await getTaskDetail(task.id);
  const patch = { statusId: resolveStatus(await loadRefs(project.id), 'done', detail.type) };
  assertCanPatchTask(project, task, patch, context.sender.id);
  await updateTask(project, task.id, patch, context.sender.id);
  return `Done: ${link(`/t/${detail.identifier}`, detail.title)} ✅`;
};

const assignTask = async (context: Context, command: Extract<Command, { kind: 'assign' }>) => {
  assertCanWrite(context.project, 'task.create');
  const refs = await loadRefs(context.project.id);
  const wanted = command.person.toLowerCase();
  const matches = ['i', 'me'].includes(wanted)
    ? refs.members.filter((member) => member.id === context.sender.id)
    : refs.members.filter((member) => member.name.toLowerCase().startsWith(wanted));
  if (!matches.length)
    return `No one called "${escape(command.person)}" here. Members: ${refs.members.map((member) => escape(member.name)).join(', ')}`;
  if (matches.length > 1)
    return `Who do you mean: ${matches.map((member) => escape(member.name)).join(', ')}?`;
  const assignee = matches[0]!;
  const input = createTaskSchema.parse({
    title: command.title,
    type: MODULE_META[context.project.module].taskTypes[0],
    assigneeId: assignee.id,
    dueDate: dueDateOf(command.when, context.timezone),
  });
  assertCanAssignOnCreate(context.project, input.assigneeId, context.sender.id);
  const task = await createTask(context.project, input, context.sender.id);
  return `Added ${link(`/t/${task.identifier}`, task.title)} for ${escape(assignee.name)}${
    task.dueDate ? `, due ${formatDay(task.dueDate, context.timezone)}` : ''
  }.`;
};

const showAppointments = async (context: Context) => {
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
      return `• <b>${escape(item.title)}</b> · ${formatTime(item.startsAt, context.timezone)} · ${minutes} min${
        item.location ? ` · ${escape(item.location)}` : ''
      }`;
    })
    .join('\n');
};

const switchProject = async (context: Context, key: string) => {
  const project = await findProjectContext(key, context.sender.id);
  if (!(await selectProject(context.chat.chat_id, project.key)))
    return `This chat isn't connected to ${escape(key)}. Connect it from that project's Settings → Telegram.`;
  return `Now working in <b>${escape(project.key)}</b>.`;
};

const run = (context: Context, command: Command): Promise<string> | string => {
  switch (command.kind) {
    case 'help':
    case 'start':
      return helpText(context.project.module === 'household');
    case 'use':
      return switchProject(context, command.key);
    case 'add':
      return addToList(context, command.items, command.list);
    case 'bought':
      return tickItems(context, command.items);
    case 'lists':
      householdOnly(context);
      return listLists(context.project.id).then(
        (lists) => lists.map(describeList).join('\n') || 'No lists yet.',
      );
    case 'list':
      return showList(context, command.name);
    case 'open_list':
      householdOnly(context);
      return command.name
        ? listLists(context.project.id).then((lists) => {
            const list = pickList(lists, command.name, context.chat);
            return link(`/p/${context.chat.key}/shopping?list=${list.id}`, `Open ${list.name}`);
          })
        : link(`/p/${context.chat.key}/shopping`, 'Open the shopping lists');
    case 'open_project':
      return link(`/p/${context.chat.key}`, `Open ${context.chat.name}`);
    case 'tasks':
    case 'mine':
      return showTasks(context, command.kind === 'mine');
    case 'task':
      return showTask(context, command.identifier);
    case 'done':
      return finishTask(context, command.identifier);
    case 'assign':
      return assignTask(context, command);
    case 'appointments':
      return showAppointments(context);
  }
};

const linkWithCode = async (message: TelegramMessage, code: string) => {
  const linked = await consumeLinkCode(code);
  if (!linked) return 'This link has expired. In MSR open the project → Settings → Telegram and try again.';
  const isGroup = GROUP_TYPES.has(message.chat.type);
  if (linked.is_group !== isGroup)
    return linked.is_group
      ? 'Open this link to add me to a group.'
      : 'Open this link in a private chat with me.';
  const project = await findProjectContext(linked.key, linked.user_id).catch(() => null);
  if (!project) return 'You are no longer a member of that project.';
  await linkUser(message.from!.id, linked.user_id);
  await linkChat(
    message.chat.id,
    project.id,
    message.chat.title ?? message.chat.first_name ?? '',
    isGroup,
    linked.user_id,
  );
  return `Connected to <b>${escape(project.key)}</b>. Send <code>help</code> to see what I can do.`;
};

export const handleMessage = async (message: TelegramMessage): Promise<string | null> => {
  if (message.migrate_to_chat_id) {
    await migrateChat(message.chat.id, message.migrate_to_chat_id);
    return null;
  }
  const text = message.text?.trim();
  if (!text || !message.from) return null;
  const command = parseCommand(text);
  try {
    if (command.kind === 'start') return await linkWithCode(message, command.code);
    const chat = await currentChat(message.chat.id);
    if (!chat) return 'This chat is not connected yet. In MSR open a project → Settings → Telegram.';
    const sender = await findSender(message.from.id);
    if (!sender)
      return `Connect your account first: MSR → ${escape(chat.name)} → Settings → Telegram → Connect me.`;
    const project = await findProjectContext(chat.key, sender.id).catch(() => null);
    if (!project) return `You are not a member of ${escape(chat.name)}.`;
    const { tier } = await currentPlan(chat.owner_id);
    if (!botAllowed(tier, project.module))
      return `This project's Telegram bot needs the ${PLAN_META[minimumBotPlan(project.module)].label} plan.`;
    const timezone = sender.preferences.timezone ?? DEFAULT_PREFERENCES.timezone;
    return await run({ chat, project, sender, timezone }, command);
  } catch (error) {
    if (error instanceof HttpError) {
      const missing = (error.details as { missing?: string[] } | undefined)?.missing;
      return missing ? `${error.message} (missing permission: ${missing.join(', ')})` : error.message;
    }
    logger.error({ err: error }, 'Telegram command failed');
    return 'Something went wrong. Try again in a moment.';
  }
};
