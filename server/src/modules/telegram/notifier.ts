import { formatMinutes } from '@msr/shared/calendar';
import { PRIORITIES, type Priority } from '@msr/shared/enums';
import { formatIdentifier } from '@msr/shared/identifiers';
import { botAllowed, type PaidTier, type ProjectModule } from '@msr/shared/modules';
import type { NotifyKind } from '@msr/shared/telegram';
import { query } from '../../db/pool';
import { logger } from '../../lib/logger';
import { activeSubscription } from '../shop/service';
import { sendMessage } from './api';
import { escape, formatDay, formatTime, link } from './format';
import { dropChat, migrateChat } from './service';

interface Note {
  projectId: string;
  kind: NotifyKind;
  line: (timezone: string) => string;
  users: (string | null)[] | null;
  actorId: string | null;
  sourceChatId: number | null;
}

interface ActivityRow {
  project_id: string;
  key: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor: string | null;
  number: number;
  title: string;
  assignee_id: string | null;
  assignee: string | null;
  reporter_id: string | null;
}

interface OutboxRow {
  project_id: string;
  kind: NotifyKind;
  payload: {
    list?: string;
    added?: string[];
    cleared?: string[];
    title?: string;
    location?: string;
    startsAt?: string;
    allDay?: boolean;
    appointment?: boolean;
  };
  actor_id: string | null;
  actor: string | null;
  source_chat_id: number | null;
}

interface OverdueRow {
  project_id: string;
  key: string;
  number: number;
  title: string;
  due_date: string;
  assignee_id: string | null;
  assignee: string | null;
  reporter_id: string | null;
}

interface DigestRow {
  chat_id: number;
  project_id: string;
  day: string;
}

interface ReminderRow {
  project_id: string;
  title: string;
  location: string;
  starts_at: Date;
  attendee_ids: string[];
}

interface ChatRow {
  chat_id: number;
  project_id: string;
  is_group: boolean;
  linked_by: string | null;
  notify: NotifyKind[];
  only_mine: boolean;
  key: string;
  name: string;
  module: ProjectModule;
  timezone: string;
  tier: PaidTier | null;
}

const ACTIVITY_DELAY = '5 seconds';
const OUTBOX_BATCH = 500;
const LINES_MAX = 30;
const TITLE_MAX = 80;
const SEND_BATCH = 20;
const DIGEST_TIME = '08:00';

const CLAIM_CURSOR = `
  WITH prev AS (SELECT activity_cursor FROM telegram_state WHERE id FOR UPDATE),
       next AS (SELECT max(id) AS id FROM task_activity WHERE created_at < now() - interval '${ACTIVITY_DELAY}')
  UPDATE telegram_state s SET activity_cursor = next.id
  FROM prev, next
  WHERE s.id AND next.id > prev.activity_cursor
  RETURNING prev.activity_cursor AS from_id, s.activity_cursor AS to_id`;
const ACTIVITY = `
  SELECT e.project_id, p.key::text AS key, e.action, e.field, e.old_value #>> '{}' AS old_value,
         e.new_value #>> '{}' AS new_value, e.actor_id, a.name AS actor, t.number, t.title,
         t.assignee_id, asg.name AS assignee, t.reporter_id
  FROM task_activity e
  JOIN tasks t ON t.id = e.task_id
  JOIN projects p ON p.id = e.project_id
  LEFT JOIN users a ON a.id = e.actor_id
  LEFT JOIN users asg ON asg.id = t.assignee_id
  WHERE e.id > $1 AND e.id <= $2
    AND (e.action IN ('created', 'commented', 'escalated')
         OR (e.action = 'updated' AND e.field IN ('assignee', 'status', 'priority')))
    AND EXISTS (SELECT 1 FROM telegram_chats c WHERE c.project_id = e.project_id)
  ORDER BY e.id`;
const CLAIM_OUTBOX = `
  WITH claimed AS (
    DELETE FROM telegram_outbox WHERE id IN (
      SELECT id FROM telegram_outbox ORDER BY id LIMIT ${OUTBOX_BATCH} FOR UPDATE SKIP LOCKED
    ) RETURNING *
  )
  SELECT c.project_id, c.kind, c.payload, c.actor_id, u.name AS actor, c.source_chat_id
  FROM claimed c LEFT JOIN users u ON u.id = c.actor_id ORDER BY c.id`;
const CLAIM_OVERDUE = `
  UPDATE tasks t SET overdue_alerted_for = t.due_date
  FROM projects p
  WHERE p.id = t.project_id AND t.completed_at IS NULL
    AND t.due_date < (now() AT TIME ZONE 'UTC')::date + 1
    AND t.overdue_alerted_for IS DISTINCT FROM t.due_date
    AND t.due_date < (now() AT TIME ZONE coalesce(
          (SELECT preferences->>'timezone' FROM users WHERE id = coalesce(t.assignee_id, t.reporter_id)), 'UTC'))::date
    AND EXISTS (SELECT 1 FROM telegram_chats c WHERE c.project_id = t.project_id AND 'overdue' = ANY(c.notify))
  RETURNING t.project_id, p.key::text AS key, t.number, t.title, t.due_date::text AS due_date,
            t.assignee_id, (SELECT name FROM users WHERE id = t.assignee_id) AS assignee, t.reporter_id`;
const CLAIM_DIGESTS = `
  UPDATE telegram_chats c SET digest_sent_on = (now() AT TIME ZONE z.timezone)::date
  FROM (SELECT id, coalesce(preferences->>'timezone', 'UTC') AS timezone FROM users) z
  WHERE z.id = c.linked_by AND 'daily_digest' = ANY(c.notify)
    AND (now() AT TIME ZONE z.timezone)::time >= '${DIGEST_TIME}'
    AND c.digest_sent_on IS DISTINCT FROM (now() AT TIME ZONE z.timezone)::date
  RETURNING c.chat_id, c.project_id, c.digest_sent_on::text AS day`;
const DIGEST_TASKS = `
  SELECT t.project_id, p.key::text AS key, t.number, t.title, t.due_date::text AS due_date,
         t.assignee_id, u.name AS assignee, t.reporter_id
  FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN users u ON u.id = t.assignee_id
  WHERE t.project_id = ANY($1::uuid[]) AND t.completed_at IS NULL AND t.due_date <= $2::date
  ORDER BY u.name NULLS LAST, t.due_date, t.number`;
const CLAIM_REMINDERS = `
  WITH due AS (
    SELECT e.id, min(m.minutes) AS minutes
    FROM calendar_events e CROSS JOIN LATERAL unnest(e.reminders) AS m(minutes)
    WHERE e.is_appointment AND e.reminders <> '{}' AND e.starts_at > now() AND e.starts_at <= now() + interval '7 days'
      AND e.starts_at - make_interval(mins => m.minutes) <= now() AND NOT m.minutes = ANY(e.reminders_sent)
    GROUP BY e.id
  )
  UPDATE calendar_events e
  SET reminders_sent = ARRAY(SELECT m FROM unnest(e.reminders) AS m WHERE m >= due.minutes)
  FROM due
  WHERE e.id = due.id AND NOT due.minutes = ANY(e.reminders_sent)
  RETURNING e.project_id, e.title, e.location, e.starts_at,
            ARRAY(SELECT user_id FROM calendar_event_attendees a WHERE a.event_id = e.id) AS attendee_ids`;
const TARGET_CHATS = `
  SELECT c.chat_id, c.project_id, c.is_group, c.linked_by, c.notify, c.only_mine, p.key::text AS key, p.name, p.module,
         coalesce(u.preferences->>'timezone', 'UTC') AS timezone,
         (SELECT s.tier FROM (${activeSubscription('p.owner_id')}) s) AS tier
  FROM telegram_chats c
  JOIN projects p ON p.id = c.project_id
  LEFT JOIN users u ON u.id = c.linked_by
  WHERE c.project_id = ANY($1::uuid[])
    AND (c.is_group OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = c.project_id AND m.user_id = c.linked_by))
  ORDER BY c.chat_id, p.key`;

let running = false;

const short = (text: string) => (text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text);

const taskLink = (key: string, number: number, title: string) => {
  const identifier = formatIdentifier(key, number);
  return link(`/t/${identifier}`, `${identifier} ${short(title)}`);
};

const by = (actor: string | null) => (actor ? ` (${escape(actor)})` : '');

const raised = (from: string | null, to: string | null) =>
  PRIORITIES.indexOf(to as Priority) < PRIORITIES.indexOf(from as Priority);

const activityKind = (row: ActivityRow): NotifyKind | null => {
  if (row.action === 'created') return 'task_created';
  if (row.action === 'commented') return 'comments';
  if (row.field === 'priority') return raised(row.old_value, row.new_value) ? 'priority_raised' : null;
  if (row.field === 'assignee') return row.new_value ? 'task_assigned' : null;
  return 'status_changed';
};

const activityLine = (kind: NotifyKind, row: ActivityRow) => {
  const task = taskLink(row.key, row.number, row.title);
  if (kind === 'task_created')
    return `🆕 ${task}${row.assignee ? ` for ${escape(row.assignee)}` : ''}${by(row.actor)}`;
  if (kind === 'comments') return `💬 ${escape(row.actor ?? 'Someone')} commented on ${task}`;
  if (kind === 'task_assigned') return `👤 ${task} → ${escape(row.new_value!)}${by(row.actor)}`;
  if (kind === 'priority_raised')
    return `⬆️ ${task}: ${row.old_value} → ${row.new_value}${row.actor ? by(row.actor) : ' (schedule)'}`;
  return `🔄 ${task}: ${escape(row.old_value ?? '')} → ${escape(row.new_value ?? '')}${by(row.actor)}`;
};

const outboxLine = (row: OutboxRow) => (timezone: string) => {
  const { payload } = row;
  const actor = escape(row.actor ?? 'Someone');
  if (payload.added)
    return `🛒 ${actor} added ${payload.added.map(escape).join(', ')} to ${escape(payload.list!)}`;
  if (payload.cleared) {
    const count = payload.cleared.length;
    return `🛒 ${actor} cleared ${count} bought item${count === 1 ? '' : 's'} from ${escape(payload.list!)}`;
  }
  const when = payload.allDay
    ? formatDay(payload.startsAt!.slice(0, 10), timezone)
    : formatTime(payload.startsAt!, timezone);
  return `📅 ${actor} added ${payload.appointment ? 'an appointment: ' : ''}<b>${escape(payload.title!)}</b> · ${when}${
    payload.location ? ` · ${escape(payload.location)}` : ''
  }`;
};

const minutesUntil = (instant: Date) => {
  const minutes = Math.max(1, Math.round((instant.getTime() - Date.now()) / 60_000));
  return minutes < 15 ? minutes : Math.round(minutes / 5) * 5;
};

const reminderLine = (row: ReminderRow) => (timezone: string) =>
  `⏰ <b>${escape(row.title)}</b> in ${formatMinutes(minutesUntil(row.starts_at))} · ${formatTime(row.starts_at, timezone)}${
    row.location ? ` · ${escape(row.location)}` : ''
  }`;

const claimActivity = async () => {
  const [range] = await query<{ from_id: string; to_id: string }>(CLAIM_CURSOR);
  return range ? query<ActivityRow>(ACTIVITY, [range.from_id, range.to_id]) : [];
};

const collectNotes = (
  activity: ActivityRow[],
  outbox: OutboxRow[],
  overdue: OverdueRow[],
  reminders: ReminderRow[],
): Note[] => [
  ...activity.flatMap((row) => {
    const kind = activityKind(row);
    if (!kind) return [];
    const line = activityLine(kind, row);
    return {
      projectId: row.project_id,
      kind,
      line: () => line,
      users: [row.assignee_id, row.reporter_id],
      actorId: row.actor_id,
      sourceChatId: null,
    };
  }),
  ...outbox.map((row) => ({
    projectId: row.project_id,
    kind: row.kind,
    line: outboxLine(row),
    users: null,
    actorId: row.actor_id,
    sourceChatId: row.source_chat_id,
  })),
  ...overdue.map((row) => ({
    projectId: row.project_id,
    kind: 'overdue' as const,
    line: (timezone: string) =>
      `⏰ ${taskLink(row.key, row.number, row.title)} was due ${formatDay(row.due_date, timezone)}${
        row.assignee ? ` · ${escape(row.assignee)}` : ''
      }`,
    users: [row.assignee_id, row.reporter_id],
    actorId: null,
    sourceChatId: null,
  })),
  ...reminders.map((row) => ({
    projectId: row.project_id,
    kind: 'appointment_reminders' as const,
    line: reminderLine(row),
    users: row.attendee_ids.length ? row.attendee_ids : null,
    actorId: null,
    sourceChatId: null,
  })),
];

const wants = (chat: ChatRow, note: Note) =>
  chat.notify.includes(note.kind) &&
  note.sourceChatId !== chat.chat_id &&
  (chat.is_group ||
    (note.actorId !== chat.linked_by &&
      (!chat.only_mine || !note.users || note.users.includes(chat.linked_by))));

const digestLines = (chat: ChatRow, day: string, tasks: OverdueRow[]) => {
  const due = tasks.filter(
    (task) =>
      task.project_id === chat.project_id &&
      task.due_date <= day &&
      (chat.is_group || !chat.only_mine || [task.assignee_id, task.reporter_id].includes(chat.linked_by)),
  );
  if (!due.length) return [];
  return [
    '☀️ <b>Due today</b>',
    ...due.map(
      (task) =>
        `• ${taskLink(task.key, task.number, task.title)} · ${escape(task.assignee ?? 'Anyone')}${
          task.due_date < day ? ` · overdue since ${formatDay(task.due_date, chat.timezone)}` : ''
        }`,
    ),
  ];
};

const compose = (sections: Map<string, string[]>) => {
  const blocks: string[] = [];
  let budget = LINES_MAX;
  let hidden = 0;
  for (const [header, lines] of sections) {
    const shown = lines.slice(0, Math.max(budget, 0));
    hidden += lines.length - shown.length;
    budget -= shown.length;
    if (shown.length) blocks.push([header, ...shown].join('\n'));
  }
  return blocks.join('\n\n') + (hidden ? `\n\n…and ${hidden} more in MSR` : '');
};

const deliver = async (chatId: number, text: string) => {
  const answer = await sendMessage(chatId, text);
  if (answer.ok) return;
  const movedTo = answer.parameters?.migrate_to_chat_id;
  if (movedTo) {
    await migrateChat(chatId, movedTo);
    await sendMessage(movedTo, text);
  } else if (answer.status === 403) await dropChat(chatId);
  else logger.warn({ chatId, answer: answer.description }, 'Telegram message failed');
};

const notify = async () => {
  const [activity, outbox, overdue, digests, reminders] = await Promise.all([
    claimActivity(),
    query<OutboxRow>(CLAIM_OUTBOX),
    query<OverdueRow>(CLAIM_OVERDUE),
    query<DigestRow>(CLAIM_DIGESTS),
    query<ReminderRow>(CLAIM_REMINDERS),
  ]);
  const notes = collectNotes(activity, outbox, overdue, reminders);
  const projectIds = [
    ...new Set([...notes.map((note) => note.projectId), ...digests.map((row) => row.project_id)]),
  ];
  if (!projectIds.length) return;
  const digestDays = new Map(digests.map((row) => [`${row.chat_id}:${row.project_id}`, row.day]));
  const [chats, digestTasks] = await Promise.all([
    query<ChatRow>(TARGET_CHATS, [projectIds]),
    digests.length
      ? query<OverdueRow>(DIGEST_TASKS, [
          [...new Set(digests.map((row) => row.project_id))],
          digests
            .map((row) => row.day)
            .sort()
            .at(-1),
        ])
      : [],
  ]);
  const messages = new Map<number, Map<string, string[]>>();
  for (const chat of chats) {
    if (!botAllowed(chat.tier ?? 'free', chat.module)) continue;
    const day = digestDays.get(`${chat.chat_id}:${chat.project_id}`);
    const lines = [
      ...notes
        .filter((note) => note.projectId === chat.project_id && wants(chat, note))
        .map((note) => note.line(chat.timezone)),
      ...(day ? digestLines(chat, day, digestTasks) : []),
    ];
    if (!lines.length) continue;
    const sections = messages.get(chat.chat_id) ?? new Map<string, string[]>();
    sections.set(`<b>${escape(chat.key)} · ${escape(chat.name)}</b>`, lines);
    messages.set(chat.chat_id, sections);
  }
  const outgoing = [...messages];
  for (let index = 0; index < outgoing.length; index += SEND_BATCH)
    await Promise.all(
      outgoing
        .slice(index, index + SEND_BATCH)
        .map(([chatId, sections]) =>
          deliver(chatId, compose(sections)).catch((err) =>
            logger.warn({ err, chatId }, 'Telegram message failed'),
          ),
        ),
    );
};

export const runNotifications = async () => {
  if (running) return;
  running = true;
  try {
    await notify();
  } finally {
    running = false;
  }
};
