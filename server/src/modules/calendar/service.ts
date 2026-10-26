import { addDays, dateSpan, rangeSpan, spansOverlap, type TimeSpan } from '@msr/shared/calendar';
import { formatIdentifier } from '@msr/shared/identifiers';
import { can } from '@msr/shared/permissions';
import type {
  CalendarConflict,
  CalendarConnection,
  CalendarItem,
  ExternalCalendarSettings,
  UpcomingConflict,
} from '@msr/shared/types';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { avatarUrl } from '../users/service';
import type { ExternalEvent } from './types';

export type Provider = 'google' | 'icloud';

export interface ConnectionRow {
  id: string;
  user_id: string;
  provider: Provider;
  account_email: string;
  credentials_sealed: string;
  calendars: ExternalCalendarSettings[];
  default_calendar_id: string | null;
  last_synced_at: Date | null;
  sync_error: string | null;
}

export interface EventRow {
  id: string;
  owner_id: string | null;
  project_id: string | null;
  created_by: string | null;
  title: string;
  description: string;
  location: string;
  starts_at: Date;
  ends_at: Date;
  all_day: boolean;
  is_important: boolean;
  read_only: boolean;
  connection_id: string | null;
  external_calendar_id: string | null;
  external_id: string | null;
  etag: string | null;
  project_key: string | null;
}

interface ListedEventRow extends EventRow {
  important: boolean;
  provider: Provider | null;
  calendar_name: string;
  color: string;
  project_key: string | null;
  project_name: string | null;
  my_permissions: number | null;
  attendees: { id: string; name: string; avatar_key: string | null }[];
}

interface DeadlineRow {
  id: string;
  title: string;
  due_date: string;
  number: number;
  key: string;
  project_name: string;
  color: string;
  description: string;
}

interface ImportantRow {
  id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  all_day: boolean;
  owner_id: string | null;
  user_id: string;
  calendar_name: string;
}

export interface NewEvent {
  ownerId: string | null;
  projectId: string | null;
  createdBy: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  important: boolean;
  attendeeIds: string[];
  external: { connectionId: string; calendarId: string; externalId: string; etag: string | null } | null;
}

const DAY_MS = 86_400_000;
const DEADLINE_OWNER = '(t.assignee_id = $1 OR (t.assignee_id IS NULL AND t.reporter_id = $1))';
const TITLE_MAX = 300;
const UPCOMING_DAYS = 30;
const PRIVATE_TITLE = 'Very important event';
const DEFAULT_COLOR = '#4f56f0';

const CONNECTION_COLUMNS =
  'id, user_id, provider, account_email, credentials_sealed, calendars, default_calendar_id, last_synced_at, sync_error';
const CALENDAR_JOIN = `
  LEFT JOIN projects p ON p.id = e.project_id
  LEFT JOIN calendar_connections c ON c.id = e.connection_id
  LEFT JOIN LATERAL (SELECT x FROM jsonb_array_elements(c.calendars) x WHERE x->>'id' = e.external_calendar_id) cx(cal) ON true`;
const SHOWN = `(e.connection_id IS NULL OR coalesce((cx.cal->>'show')::bool, false))`;
const IMPORTANT = `(e.is_important OR coalesce((cx.cal->>'important')::bool, false))`;
const CALENDAR_NAME = `coalesce(cx.cal->>'name', p.name, 'My events')`;

const LIST_EVENTS = `
  SELECT e.*, ${IMPORTANT} AS important, c.provider, ${CALENDAR_NAME} AS calendar_name,
         coalesce(cx.cal->>'color', p.color, '${DEFAULT_COLOR}') AS color, p.key::text AS project_key, p.name AS project_name,
         (SELECT r.permissions FROM project_members pm JOIN project_roles r ON r.id = pm.role_id
          WHERE pm.project_id = e.project_id AND pm.user_id = $1) AS my_permissions,
         coalesce((SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'avatar_key', u.avatar_key) ORDER BY u.name)
                   FROM calendar_event_attendees a JOIN users u ON u.id = a.user_id WHERE a.event_id = e.id), '[]') AS attendees
  FROM calendar_events e
  ${CALENDAR_JOIN}
  WHERE e.starts_at < $3 AND e.ends_at > $2 AND ${SHOWN}
    AND CASE WHEN $4::uuid IS NULL
             THEN e.owner_id = $1 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = e.project_id AND pm.user_id = $1)
             ELSE e.project_id = $4 END
    AND ($5::bool OR e.connection_id IS NULL)
    AND ($6::uuid IS NULL OR e.id = $6)
  ORDER BY e.starts_at, e.title`;
const LIST_DEADLINES = `
  SELECT t.id, t.title, t.due_date::text, t.number, p.key::text AS key, p.name AS project_name, p.color, t.description
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN project_statuses s ON s.id = t.status_id
  WHERE t.due_date BETWEEN $2::date AND $3::date AND s.category <> 'done'
    AND CASE WHEN $4::uuid IS NULL THEN ${DEADLINE_OWNER} ELSE t.project_id = $4 END
  ORDER BY t.due_date, t.number`;
const IMPORTANT_EVENTS = `
  SELECT e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.owner_id, u.id AS user_id, ${CALENDAR_NAME} AS calendar_name
  FROM users u
  JOIN calendar_events e ON (
    e.owner_id = u.id
    OR (e.project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = u.id)
        AND (NOT EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = e.id)
             OR EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = e.id AND a.user_id = u.id))))
  ${CALENDAR_JOIN}
  WHERE u.id = ANY($1::uuid[]) AND e.starts_at < $3 AND e.ends_at > $2 AND ${SHOWN} AND ${IMPORTANT}
    AND ($4::uuid IS NULL OR e.id <> $4)`;
const PEOPLE = `
  SELECT id, name, coalesce(preferences->>'timezone', 'UTC') AS timezone FROM users WHERE id = ANY($1::uuid[])`;
const VISIBLE_PEOPLE = `
  SELECT DISTINCT other.user_id FROM project_members mine
  JOIN project_members other ON other.project_id = mine.project_id
  WHERE mine.user_id = $1 AND other.user_id = ANY($2::uuid[])`;
const MY_OPEN_DEADLINES = `
  SELECT t.id, t.title, t.due_date::text, t.number, p.key::text AS key
  FROM tasks t JOIN projects p ON p.id = t.project_id JOIN project_statuses s ON s.id = t.status_id
  WHERE ${DEADLINE_OWNER} AND s.category <> 'done' AND t.due_date BETWEEN $2::date AND $3::date`;
const MY_APP_EVENTS = `
  SELECT e.id, e.title, e.starts_at, e.ends_at, e.all_day FROM calendar_events e
  WHERE e.connection_id IS NULL AND e.starts_at < $3 AND e.ends_at > $2
    AND (e.owner_id = $1
         OR (e.project_id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $1)
             AND (NOT EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = e.id)
                  OR EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = e.id AND a.user_id = $1))))`;
const GET_EVENT = `
  SELECT e.*, p.key::text AS project_key FROM calendar_events e LEFT JOIN projects p ON p.id = e.project_id WHERE e.id = $1`;
const INSERT_EVENT = `
  INSERT INTO calendar_events (owner_id, project_id, created_by, title, description, location, starts_at, ends_at, all_day,
                               is_important, connection_id, external_calendar_id, external_id, etag)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`;
const UPDATE_EVENT = `
  UPDATE calendar_events SET title = $2, description = $3, location = $4, starts_at = $5, ends_at = $6, all_day = $7,
         is_important = $8, etag = $9, updated_at = now()
  WHERE id = $1`;
const DELETE_EVENT = 'DELETE FROM calendar_events WHERE id = $1';
const CLEAR_ATTENDEES = 'DELETE FROM calendar_event_attendees WHERE event_id = $1';
const INSERT_ATTENDEES =
  'INSERT INTO calendar_event_attendees (event_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING';
const MEMBER_IDS = 'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])';
const LIST_CONNECTIONS = `SELECT ${CONNECTION_COLUMNS} FROM calendar_connections WHERE user_id = $1 ORDER BY created_at`;
const GET_CONNECTION = `SELECT ${CONNECTION_COLUMNS} FROM calendar_connections WHERE id = $1 AND user_id = $2`;
const UPSERT_CONNECTION = `
  INSERT INTO calendar_connections (user_id, provider, account_email, credentials_sealed) VALUES ($1, $2, $3, $4)
  ON CONFLICT (user_id, provider, account_email)
  DO UPDATE SET credentials_sealed = EXCLUDED.credentials_sealed, sync_error = NULL
  RETURNING ${CONNECTION_COLUMNS}`;
const UPDATE_CONNECTION = `
  UPDATE calendar_connections SET calendars = coalesce($3, calendars), default_calendar_id = CASE WHEN $4 THEN $5 ELSE default_calendar_id END
  WHERE id = $1 AND user_id = $2 RETURNING ${CONNECTION_COLUMNS}`;
const MARK_SYNCED = `
  UPDATE calendar_connections SET calendars = $2, last_synced_at = now(), sync_error = NULL,
         default_calendar_id = coalesce(default_calendar_id, $3)
  WHERE id = $1`;
const MARK_SYNC_ERROR =
  'UPDATE calendar_connections SET sync_error = $2, last_synced_at = now() WHERE id = $1';
const DELETE_CONNECTION = `DELETE FROM calendar_connections WHERE id = $1 AND user_id = $2 RETURNING ${CONNECTION_COLUMNS}`;
const STALE_CONNECTIONS = `
  SELECT ${CONNECTION_COLUMNS} FROM calendar_connections
  WHERE ($1::uuid IS NULL OR user_id = $1) AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(mins => $2))
  ORDER BY last_synced_at NULLS FIRST LIMIT $3`;
const UPSERT_EXTERNAL = `
  INSERT INTO calendar_events (owner_id, connection_id, external_calendar_id, external_id, etag, title, description, location,
                               starts_at, ends_at, all_day, is_important, read_only)
  SELECT $1, $2, x.calendar_id, x.external_id, x.etag, x.title, x.description, x.location, x.starts_at, x.ends_at, x.all_day,
         x.important, x.read_only
  FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::timestamptz[], $10::timestamptz[],
              $11::bool[], $12::bool[], $13::bool[])
    AS x(calendar_id, external_id, etag, title, description, location, starts_at, ends_at, all_day, important, read_only)
  ON CONFLICT (connection_id, external_calendar_id, external_id) WHERE connection_id IS NOT NULL
  DO UPDATE SET etag = EXCLUDED.etag, title = EXCLUDED.title, description = EXCLUDED.description,
                location = EXCLUDED.location, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
                all_day = EXCLUDED.all_day, is_important = EXCLUDED.is_important, read_only = EXCLUDED.read_only,
                updated_at = now()`;
const PRUNE_EXTERNAL = `
  DELETE FROM calendar_events e
  WHERE e.connection_id = $1
    AND (NOT (e.external_calendar_id = ANY($2::text[]))
         OR (e.starts_at < $4 AND e.ends_at > $3
             AND NOT EXISTS (SELECT 1 FROM unnest($5::text[], $6::text[]) k(calendar_id, external_id)
                             WHERE k.calendar_id = e.external_calendar_id AND k.external_id = e.external_id)))`;
const FEED_USER = 'SELECT id FROM users WHERE calendar_feed_hash = $1';
const FEED_TOKEN = 'SELECT calendar_feed_token FROM users WHERE id = $1';
const SET_FEED_TOKEN = 'UPDATE users SET calendar_feed_hash = $2, calendar_feed_token = $3 WHERE id = $1';

const toInstant = (date: Date) => date.toISOString();

export const normalizeRange = (startsAt: string, endsAt: string, allDay: boolean) => {
  if (!allDay) return { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
  const start = startsAt.slice(0, 10);
  const end = endsAt.slice(0, 10) > start ? endsAt.slice(0, 10) : addDays(start, 1);
  return { startsAt: `${start}T00:00:00.000Z`, endsAt: `${end}T00:00:00.000Z` };
};

const deadlineItem = (row: DeadlineRow): CalendarItem => ({
  id: row.id,
  kind: 'task',
  title: row.title,
  startsAt: `${row.due_date}T00:00:00.000Z`,
  endsAt: `${addDays(row.due_date, 1)}T00:00:00.000Z`,
  allDay: true,
  important: false,
  source: 'app',
  calendarName: row.project_name,
  color: row.color,
  project: { key: row.key, name: row.project_name },
  taskIdentifier: formatIdentifier(row.key, row.number),
  description: row.description,
  location: '',
  attendees: [],
  editable: false,
  connectionId: null,
});

const eventItem = (row: ListedEventRow, userId: string): CalendarItem => ({
  id: row.id,
  kind: 'event',
  title: row.title,
  startsAt: toInstant(row.starts_at),
  endsAt: toInstant(row.ends_at),
  allDay: row.all_day,
  important: row.important,
  source: row.provider ?? 'app',
  calendarName: row.calendar_name,
  color: row.color,
  project: row.project_key ? { key: row.project_key, name: row.project_name! } : null,
  taskIdentifier: null,
  description: row.description,
  location: row.location,
  attendees: row.attendees.map((person) => ({
    id: person.id,
    name: person.name,
    avatarUrl: avatarUrl(person.id, person.avatar_key),
  })),
  editable: row.project_id
    ? row.created_by === userId || can(row.my_permissions ?? 0, 'task.edit_any')
    : row.owner_id === userId && !row.read_only,
  connectionId: row.connection_id,
});

export const listCalendarItems = async (
  userId: string,
  from: string,
  to: string,
  projectId: string | null,
  includeExternal = true,
) => {
  const start = `${from}T00:00:00.000Z`;
  const end = `${addDays(to, 1)}T00:00:00.000Z`;
  const [events, deadlines] = await Promise.all([
    query<ListedEventRow>(LIST_EVENTS, [userId, start, end, projectId, includeExternal, null]),
    query<DeadlineRow>(LIST_DEADLINES, [userId, from, to, projectId]),
  ]);
  return [...events.map((row) => eventItem(row, userId)), ...deadlines.map(deadlineItem)].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
};

export const visiblePeople = async (userId: string, ids: string[]) => {
  const others = ids.filter((id) => id !== userId);
  const visible = others.length
    ? (await query<{ user_id: string }>(VISIBLE_PEOPLE, [userId, others])).map((row) => row.user_id)
    : [];
  return ids.includes(userId) ? [userId, ...visible] : visible;
};

const conflictOf = (row: ImportantRow, viewerId: string, personName: string): CalendarConflict => {
  const isPrivate = row.owner_id !== null && row.owner_id !== viewerId;
  return {
    id: row.id,
    title: isPrivate ? PRIVATE_TITLE : row.title,
    startsAt: toInstant(row.starts_at),
    endsAt: toInstant(row.ends_at),
    allDay: row.all_day,
    calendarName: isPrivate ? 'Private' : row.calendar_name,
    personName,
  };
};

export const findConflicts = async (
  viewerId: string,
  userIds: string[],
  target: { date?: string; startsAt?: string; endsAt?: string; allDay?: boolean },
  excludeEventId: string | null = null,
) => {
  const people = await query<{ id: string; name: string; timezone: string }>(PEOPLE, [userIds]);
  if (!people.length) return [];
  const spanFor = (timezone: string): TimeSpan =>
    target.date
      ? dateSpan(target.date, timezone)
      : rangeSpan({ startsAt: target.startsAt!, endsAt: target.endsAt!, allDay: !!target.allDay }, timezone);
  const spans = people.map((person) => spanFor(person.timezone));
  const windowStart = new Date(Math.min(...spans.map((span) => span.start)) - DAY_MS);
  const windowEnd = new Date(Math.max(...spans.map((span) => span.end)) + DAY_MS);
  const rows = await query<ImportantRow>(IMPORTANT_EVENTS, [userIds, windowStart, windowEnd, excludeEventId]);
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const person = people.find((item) => item.id === row.user_id)!;
    const span = spans[people.indexOf(person)]!;
    const eventSpan = rangeSpan(
      { startsAt: toInstant(row.starts_at), endsAt: toInstant(row.ends_at), allDay: row.all_day },
      person.timezone,
    );
    if (!spansOverlap(span, eventSpan) || seen.has(row.id)) return [];
    seen.add(row.id);
    return [conflictOf(row, viewerId, person.name)];
  });
};

export const upcomingConflicts = async (userId: string, timezone: string): Promise<UpcomingConflict[]> => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const last = addDays(today, UPCOMING_DAYS);
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS);
  const to = new Date(Date.parse(`${last}T00:00:00Z`) + 2 * DAY_MS);
  const [deadlines, events, important] = await Promise.all([
    query<{ id: string; title: string; due_date: string; number: number; key: string }>(MY_OPEN_DEADLINES, [
      userId,
      today,
      last,
    ]),
    query<{ id: string; title: string; starts_at: Date; ends_at: Date; all_day: boolean }>(MY_APP_EVENTS, [
      userId,
      from,
      to,
    ]),
    query<ImportantRow>(IMPORTANT_EVENTS, [[userId], from, to, null]),
  ]);
  if (!important.length) return [];
  const importantSpans = important.map((row) => ({
    row,
    span: rangeSpan(
      { startsAt: toInstant(row.starts_at), endsAt: toInstant(row.ends_at), allDay: row.all_day },
      timezone,
    ),
  }));
  const clashesFor = (span: TimeSpan, selfId: string | null) =>
    importantSpans
      .filter((entry) => entry.row.id !== selfId && spansOverlap(span, entry.span))
      .map((entry) => conflictOf(entry.row, userId, ''));
  return [
    ...deadlines.map((task) => ({
      item: {
        kind: 'task' as const,
        id: task.id,
        title: task.title,
        date: task.due_date,
        identifier: formatIdentifier(task.key, task.number),
      },
      clashes: clashesFor(dateSpan(task.due_date, timezone), null),
    })),
    ...events.map((event) => ({
      item: {
        kind: 'event' as const,
        id: event.id,
        title: event.title,
        date: toInstant(event.starts_at),
        identifier: null,
      },
      clashes: clashesFor(
        rangeSpan(
          { startsAt: toInstant(event.starts_at), endsAt: toInstant(event.ends_at), allDay: event.all_day },
          timezone,
        ),
        event.id,
      ),
    })),
  ]
    .filter((entry) => entry.clashes.length)
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
};

export const getEvent = (id: string, db?: Db) => queryOne<EventRow>(GET_EVENT, [id], db);

export const assertProjectAttendees = async (projectId: string, attendeeIds: string[]) => {
  const ids = [...new Set(attendeeIds)];
  if (!ids.length) return true;
  const found = await query(MEMBER_IDS, [projectId, ids]);
  return found.length === ids.length;
};

export const insertEvent = (input: NewEvent) =>
  transaction(async (db) => {
    const created = await queryOne<{ id: string }>(
      INSERT_EVENT,
      [
        input.ownerId,
        input.projectId,
        input.createdBy,
        input.title.slice(0, TITLE_MAX),
        input.description,
        input.location,
        input.startsAt,
        input.endsAt,
        input.allDay,
        input.important,
        input.external?.connectionId ?? null,
        input.external?.calendarId ?? null,
        input.external?.externalId ?? null,
        input.external?.etag ?? null,
      ],
      db,
    );
    if (input.attendeeIds.length) await query(INSERT_ATTENDEES, [created!.id, input.attendeeIds], db);
    return created!.id;
  });

export const saveEvent = (
  event: EventRow,
  fields: Pick<
    NewEvent,
    'title' | 'description' | 'location' | 'startsAt' | 'endsAt' | 'allDay' | 'important'
  >,
  etag: string | null,
  attendeeIds?: string[],
) =>
  transaction(async (db) => {
    await query(
      UPDATE_EVENT,
      [
        event.id,
        fields.title.slice(0, TITLE_MAX),
        fields.description,
        fields.location,
        fields.startsAt,
        fields.endsAt,
        fields.allDay,
        fields.important,
        etag,
      ],
      db,
    );
    if (attendeeIds) {
      await query(CLEAR_ATTENDEES, [event.id], db);
      if (attendeeIds.length) await query(INSERT_ATTENDEES, [event.id, attendeeIds], db);
    }
  });

export const deleteEvent = (id: string) => query(DELETE_EVENT, [id]);

export const getCalendarItem = async (userId: string, eventId: string) => {
  const [row] = await query<ListedEventRow>(LIST_EVENTS, [
    userId,
    '-infinity',
    'infinity',
    null,
    true,
    eventId,
  ]);
  return row ? eventItem(row, userId) : null;
};

export const toConnection = (row: ConnectionRow): CalendarConnection => ({
  id: row.id,
  provider: row.provider,
  accountEmail: row.account_email,
  calendars: row.calendars,
  defaultCalendarId: row.default_calendar_id,
  lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
  syncError: row.sync_error,
});

export const listConnections = (userId: string) => query<ConnectionRow>(LIST_CONNECTIONS, [userId]);

export const getConnection = (id: string, userId: string) =>
  queryOne<ConnectionRow>(GET_CONNECTION, [id, userId]);

export const upsertConnection = (userId: string, provider: Provider, email: string, sealed: string) =>
  queryOne<ConnectionRow>(UPSERT_CONNECTION, [userId, provider, email, sealed]).then((row) => row!);

export const updateConnection = (
  id: string,
  userId: string,
  calendars: ExternalCalendarSettings[] | null,
  defaultCalendarId: string | null | undefined,
) =>
  queryOne<ConnectionRow>(UPDATE_CONNECTION, [
    id,
    userId,
    calendars ? JSON.stringify(calendars) : null,
    defaultCalendarId !== undefined,
    defaultCalendarId ?? null,
  ]);

export const deleteConnection = (id: string, userId: string) =>
  queryOne<ConnectionRow>(DELETE_CONNECTION, [id, userId]);

export const staleConnections = (userId: string | null, minutes: number, limit: number) =>
  query<ConnectionRow>(STALE_CONNECTIONS, [userId, minutes, limit]);

export const storeSyncedEvents = (
  connection: ConnectionRow,
  calendars: ExternalCalendarSettings[],
  events: ExternalEvent[],
  from: Date,
  to: Date,
) =>
  transaction(async (db) => {
    const shownIds = calendars.filter((calendar) => calendar.show).map((calendar) => calendar.id);
    await query(
      UPSERT_EXTERNAL,
      [
        connection.user_id,
        connection.id,
        events.map((event) => event.calendarId),
        events.map((event) => event.externalId),
        events.map((event) => event.etag),
        events.map((event) => event.title.slice(0, TITLE_MAX) || '(No title)'),
        events.map((event) => event.description.slice(0, 5000)),
        events.map((event) => event.location.slice(0, 300)),
        events.map((event) => event.startsAt),
        events.map((event) => (event.endsAt < event.startsAt ? event.startsAt : event.endsAt)),
        events.map((event) => event.allDay),
        events.map((event) => event.important),
        events.map((event) => event.readOnly),
      ],
      db,
    );
    await query(
      PRUNE_EXTERNAL,
      [
        connection.id,
        shownIds,
        from,
        to,
        events.map((event) => event.calendarId),
        events.map((event) => event.externalId),
      ],
      db,
    );
    const primary = calendars.find((calendar) => calendar.writable)?.id ?? null;
    await query(MARK_SYNCED, [connection.id, JSON.stringify(calendars), primary], db);
  });

export const markSyncError = (connectionId: string, message: string) =>
  query(MARK_SYNC_ERROR, [connectionId, message]);

export const feedUserId = (tokenHash: Buffer) =>
  queryOne<{ id: string }>(FEED_USER, [tokenHash]).then((row) => row?.id ?? null);

export const feedToken = (userId: string) =>
  queryOne<{ calendar_feed_token: string | null }>(FEED_TOKEN, [userId]).then(
    (row) => row?.calendar_feed_token ?? null,
  );

export const setFeedToken = (userId: string, hash: Buffer, sealed: string) =>
  query(SET_FEED_TOKEN, [userId, hash, sealed]);
