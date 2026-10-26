import { randomUUID } from 'node:crypto';
import { createDAVClient, type DAVCalendar } from 'tsdav';
import { HttpError } from '../../lib/httpError';
import { buildCalendarObject, parseCalendarObject, updateCalendarObject } from './icalendar';
import type { CalendarProvider } from './types';

export interface ICloudCredentials {
  username: string;
  password: string;
}

type DavClient = Awaited<ReturnType<typeof createDAVClient>>;

const SERVER = 'https://caldav.icloud.com';
const CLIENT_TTL_MS = 10 * 60_000;
const REJECTED = 'Apple rejected this Apple ID or app-specific password.';
const clients = new Map<string, { client: DavClient; expiresAt: number }>();

const clientFor = async (credentials: ICloudCredentials) => {
  const key = `${credentials.username}:${credentials.password}`;
  const cached = clients.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.client;
  try {
    const client = await createDAVClient({
      serverUrl: SERVER,
      credentials: { username: credentials.username, password: credentials.password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
    clients.set(key, { client, expiresAt: Date.now() + CLIENT_TTL_MS });
    return client;
  } catch {
    throw new HttpError(400, REJECTED);
  }
};

const assertOk = (response: Response) => {
  if (response.status === 412)
    throw new HttpError(409, 'This event changed in iCloud. Refresh and try again.');
  if (response.status === 401 || response.status === 403) throw new HttpError(400, REJECTED);
  if (!response.ok) throw new HttpError(502, `iCloud answered with an error (${response.status}).`);
  return response.headers.get('etag');
};

const objectUrl = (externalId: string) => externalId.split('#')[0]!;

const displayName = (calendar: DAVCalendar) =>
  typeof calendar.displayName === 'string' && calendar.displayName ? calendar.displayName : 'iCloud calendar';

export const icloud: CalendarProvider<ICloudCredentials> = {
  listCalendars: async (credentials) => {
    const calendars = await (await clientFor(credentials)).fetchCalendars();
    return calendars
      .filter((calendar) => !calendar.components || calendar.components.includes('VEVENT'))
      .map((calendar) => ({
        id: calendar.url,
        name: displayName(calendar),
        color: (calendar.calendarColor as string | undefined)?.slice(0, 7) ?? '#3b82f6',
        writable: true,
        selected: true,
      }));
  },
  listEvents: async (credentials, calendar, from, to) => {
    const objects = await (
      await clientFor(credentials)
    ).fetchCalendarObjects({
      calendar: { url: calendar.id } as DAVCalendar,
      timeRange: { start: from.toISOString(), end: to.toISOString() },
    });
    return objects.flatMap((object) =>
      object.data
        ? parseCalendarObject(
            object.data,
            object.url,
            calendar.id,
            object.etag ?? null,
            !calendar.writable,
            from,
            to,
          )
        : [],
    );
  },
  createEvent: async (credentials, calendarId, draft) => {
    const uid = randomUUID();
    const filename = `${uid}.ics`;
    const response = await (
      await clientFor(credentials)
    ).createCalendarObject({
      calendar: { url: calendarId } as DAVCalendar,
      filename,
      iCalString: buildCalendarObject(uid, draft),
    });
    return {
      externalId: new URL(filename, calendarId.endsWith('/') ? calendarId : `${calendarId}/`).toString(),
      etag: assertOk(response),
    };
  },
  updateEvent: async (credentials, calendarId, externalId, etag, draft) => {
    const client = await clientFor(credentials);
    const url = objectUrl(externalId);
    const [current] = await client.fetchCalendarObjects({
      calendar: { url: calendarId } as DAVCalendar,
      objectUrls: [url],
    });
    if (!current?.data) throw new HttpError(404, 'This event no longer exists in iCloud');
    const response = await client.updateCalendarObject({
      calendarObject: { url, data: updateCalendarObject(current.data, draft), etag: etag ?? current.etag },
    });
    return { etag: assertOk(response) };
  },
  deleteEvent: async (credentials, _calendarId, externalId, etag) => {
    const response = await (
      await clientFor(credentials)
    ).deleteCalendarObject({
      calendarObject: { url: objectUrl(externalId), etag: etag ?? undefined },
    });
    if (response.status !== 404) assertOk(response);
  },
};
