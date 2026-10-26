import { config } from '../../config';
import { HttpError } from '../../lib/httpError';
import type { CalendarProvider, EventDraft, ExternalEvent } from './types';

export interface GoogleCredentials {
  refreshToken: string;
}

interface GoogleEvent {
  id: string;
  status: string;
  etag: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar';
const IMPORTANT_COLOR = '11';
const IMPORTANT_KEY = 'msrImportant';
const TIMEOUT_MS = 20_000;
const EXPIRY_MARGIN_MS = 60_000;
const REVOKED = 'Google access expired or was revoked. Reconnect Google in Settings → Calendars.';

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

export const googleConfigured = () => !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET;

export const googleRedirectUri = () => `${config.APP_URL}/api/calendar/google/callback`;

export const googleAuthUrl = (state: string) =>
  `${AUTH_URL}?${new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })}`;

const tokenRequest = async (params: Record<string, string>) => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new HttpError(response.status === 400 ? 400 : 502, REVOKED);
  return (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
};

export const exchangeGoogleCode = async (code: string) => {
  const tokens = await tokenRequest({
    code,
    grant_type: 'authorization_code',
    redirect_uri: googleRedirectUri(),
  });
  if (!tokens.refresh_token)
    throw new HttpError(400, 'Google did not grant offline access. Try connecting again.');
  const profile = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).then((response) => response.json() as Promise<{ email?: string }>);
  accessTokens.set(tokens.refresh_token, {
    token: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000 - EXPIRY_MARGIN_MS,
  });
  return { refreshToken: tokens.refresh_token, email: profile.email ?? 'Google account' };
};

export const revokeGoogle = (credentials: GoogleCredentials) =>
  fetch(`${REVOKE_URL}?token=${encodeURIComponent(credentials.refreshToken)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined);

const accessToken = async ({ refreshToken }: GoogleCredentials, force = false) => {
  const cached = accessTokens.get(refreshToken);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.token;
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  accessTokens.set(refreshToken, {
    token: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000 - EXPIRY_MARGIN_MS,
  });
  return tokens.access_token;
};

const call = async <T>(
  credentials: GoogleCredentials,
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> => {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(credentials, retried)}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401 && !retried) return call(credentials, path, init, true);
  if (response.status === 401) throw new HttpError(400, REVOKED);
  if (response.status === 412)
    throw new HttpError(409, 'This event changed in Google Calendar. Refresh and try again.');
  if (response.status === 403) throw new HttpError(403, "Google won't let you change this calendar.");
  if (!response.ok) throw new HttpError(502, `Google Calendar answered with an error (${response.status}).`);
  return (response.status === 204 ? undefined : await response.json()) as T;
};

const toInstant = (value: { date?: string; dateTime?: string }) =>
  value.date ? `${value.date}T00:00:00.000Z` : new Date(value.dateTime!).toISOString();

const toGoogleTime = (iso: string, allDay: boolean) =>
  allDay ? { date: iso.slice(0, 10) } : { dateTime: iso };

const toBody = (draft: EventDraft) => ({
  summary: draft.title,
  description: draft.description,
  location: draft.location,
  start: toGoogleTime(draft.startsAt, draft.allDay),
  end: toGoogleTime(draft.endsAt, draft.allDay),
  extendedProperties: { private: { [IMPORTANT_KEY]: draft.important ? '1' : '0' } },
});

const calendarPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

export const google: CalendarProvider<GoogleCredentials> = {
  listCalendars: async (credentials) => {
    const { items } = await call<{
      items: {
        id: string;
        summary: string;
        backgroundColor?: string;
        accessRole: string;
        selected?: boolean;
        primary?: boolean;
      }[];
    }>(credentials, '/users/me/calendarList?minAccessRole=reader');
    return items.map((item) => ({
      id: item.id,
      name: item.summary,
      color: item.backgroundColor ?? '#4285f4',
      writable: item.accessRole === 'owner' || item.accessRole === 'writer',
      selected: !!(item.selected || item.primary),
    }));
  },
  listEvents: async (credentials, calendar, from, to) => {
    const events: ExternalEvent[] = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({
        singleEvents: 'true',
        maxResults: '2500',
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        ...(pageToken ? { pageToken } : {}),
      });
      const page = await call<{ items: GoogleEvent[]; nextPageToken?: string }>(
        credentials,
        `${calendarPath(calendar.id)}?${query}`,
      );
      page.items
        .filter((event) => event.status !== 'cancelled')
        .forEach((event) =>
          events.push({
            calendarId: calendar.id,
            externalId: event.id,
            etag: event.etag,
            title: event.summary || '(No title)',
            description: event.description ?? '',
            location: event.location ?? '',
            startsAt: toInstant(event.start),
            endsAt: toInstant(event.end),
            allDay: !!event.start.date,
            important:
              event.colorId === IMPORTANT_COLOR || event.extendedProperties?.private?.[IMPORTANT_KEY] === '1',
            readOnly: !calendar.writable,
          }),
        );
      pageToken = page.nextPageToken ?? '';
    } while (pageToken);
    return events;
  },
  createEvent: async (credentials, calendarId, draft) => {
    const created = await call<GoogleEvent>(credentials, calendarPath(calendarId), {
      method: 'POST',
      body: JSON.stringify(toBody(draft)),
    });
    return { externalId: created.id, etag: created.etag };
  },
  updateEvent: async (credentials, calendarId, externalId, etag, draft) => {
    const updated = await call<GoogleEvent>(
      credentials,
      `${calendarPath(calendarId)}/${encodeURIComponent(externalId)}`,
      {
        method: 'PATCH',
        headers: etag ? { 'If-Match': etag } : {},
        body: JSON.stringify(toBody(draft)),
      },
    );
    return { etag: updated.etag };
  },
  deleteEvent: async (credentials, calendarId, externalId, etag) => {
    await call(credentials, `${calendarPath(calendarId)}/${encodeURIComponent(externalId)}`, {
      method: 'DELETE',
      headers: etag ? { 'If-Match': etag } : {},
    });
  },
};
