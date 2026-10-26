import { Router, type Request } from 'express';
import { tokenSchema } from '@msr/shared/schemas/auth';
import {
  calendarQuerySchema,
  conflictQuerySchema,
  createEventSchema,
  icloudConnectSchema,
  updateConnectionSchema,
  updateEventSchema,
} from '@msr/shared/schemas/calendar';
import { config } from '../../config';
import { badRequest, forbidden, HttpError, notFound } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { openSecret, sealSecret } from '../../lib/secretBox';
import { hashToken, randomToken } from '../../lib/tokens';
import type { RateLimits } from '../../middleware/rateLimits';
import { assertCan, assertWritable, findProjectContext } from '../projects/access';
import { timezoneOf } from '../projects/routes';
import { buildFeed, feedUrlOf } from './feed';
import {
  exchangeGoogleCode,
  googleAuthUrl,
  googleConfigured,
  revokeGoogle,
  type GoogleCredentials,
} from './google';
import { icloud } from './icloud';
import {
  assertProjectAttendees,
  deleteConnection,
  deleteEvent,
  feedToken,
  feedUserId,
  findConflicts,
  getCalendarItem,
  getConnection,
  getEvent,
  listCalendarItems,
  listConnections,
  normalizeRange,
  saveEvent,
  setFeedToken,
  toConnection,
  upcomingConflicts,
  updateConnection,
  upsertConnection,
  visiblePeople,
  type EventRow,
} from './service';
import { createEvent } from './events';
import { connectionClient, syncConnection, syncStaleConnections } from './sync';

const STATE_COOKIE = 'gcal_state';
const STATE_PATH = '/api/calendar/google';
const STATE_TTL_MS = 10 * 60_000;
const NOT_FOUND = 'Event not found';
const ON_DEMAND_STALE_MINUTES = 5;
const ON_DEMAND_LIMIT = 5;

const userOf = (req: Request) => req.user!.id;

const loadEditableEvent = async (req: Request) => {
  const event = await getEvent(String(req.params.id));
  if (!event) throw notFound(NOT_FOUND);
  if (event.owner_id) {
    if (event.owner_id !== userOf(req)) throw notFound(NOT_FOUND);
    if (event.read_only) throw forbidden('This calendar is read-only');
    return { event, project: null };
  }
  const project = await findProjectContext(event.project_key!, userOf(req));
  assertWritable(project);
  if (event.created_by !== userOf(req)) assertCan(project, 'task.edit_any');
  return { event, project };
};

const remoteFor = async (event: EventRow, userId: string) => {
  const connection = await getConnection(event.connection_id!, userId);
  if (!connection) throw notFound(NOT_FOUND);
  return { connection, ...connectionClient(connection) };
};

const resyncOnConflict = (connection: Parameters<typeof syncConnection>[0]) => (error: unknown) => {
  if (error instanceof HttpError && error.status === 409) void syncConnection(connection);
  throw error;
};

export const createCalendarRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/events', async (req, res) => {
    const input = calendarQuerySchema.parse(req.query);
    const project = input.projectKey ? await findProjectContext(input.projectKey, userOf(req)) : null;
    syncStaleConnections(userOf(req), ON_DEMAND_STALE_MINUTES, ON_DEMAND_LIMIT).catch((err) =>
      logger.warn({ err }, 'On-demand calendar sync failed'),
    );
    res.json({ items: await listCalendarItems(userOf(req), input.from, input.to, project?.id ?? null) });
  });

  router.post('/events', async (req, res) => {
    const id = await createEvent(userOf(req), createEventSchema.parse(req.body));
    res.status(201).json({ event: await getCalendarItem(userOf(req), id) });
  });

  router.patch('/events/:id', async (req, res) => {
    const { event, project } = await loadEditableEvent(req);
    const input = updateEventSchema.parse(req.body);
    const allDay = input.allDay ?? event.all_day;
    const fields = {
      title: input.title ?? event.title,
      description: input.description ?? event.description,
      location: input.location ?? event.location,
      allDay,
      important: input.important ?? event.is_important,
      ...normalizeRange(
        input.startsAt ?? event.starts_at.toISOString(),
        input.endsAt ?? event.ends_at.toISOString(),
        allDay,
      ),
    };
    if (input.attendeeIds) {
      if (!project) throw badRequest('Pick a project to invite people to an event');
      if (!(await assertProjectAttendees(project.id, input.attendeeIds)))
        throw badRequest('Attendees must be members of the project');
    }
    let etag = event.etag;
    if (event.connection_id) {
      const { connection, provider, credentials } = await remoteFor(event, userOf(req));
      etag = (
        await provider
          .updateEvent(credentials, event.external_calendar_id!, event.external_id!, event.etag, fields)
          .catch(resyncOnConflict(connection))
      ).etag;
    }
    await saveEvent(event, fields, etag, input.attendeeIds);
    res.json({ event: await getCalendarItem(userOf(req), event.id) });
  });

  router.delete('/events/:id', async (req, res) => {
    const { event } = await loadEditableEvent(req);
    if (event.connection_id) {
      const { connection, provider, credentials } = await remoteFor(event, userOf(req));
      await provider
        .deleteEvent(credentials, event.external_calendar_id!, event.external_id!, event.etag)
        .catch(resyncOnConflict(connection));
    }
    await deleteEvent(event.id);
    res.status(204).end();
  });

  router.get('/conflicts', async (req, res) => {
    const input = conflictQuerySchema.parse(req.query);
    const people = await visiblePeople(userOf(req), input.userIds.length ? input.userIds : [userOf(req)]);
    res.json({
      conflicts: await findConflicts(userOf(req), people, input, input.excludeEventId ?? null),
    });
  });

  router.get('/conflicts/upcoming', async (req, res) => {
    res.json({ conflicts: await upcomingConflicts(userOf(req), timezoneOf(req)) });
  });

  router.get('/connections', async (req, res) => {
    const sealed = await feedToken(userOf(req));
    res.json({
      connections: (await listConnections(userOf(req))).map(toConnection),
      feedUrl: sealed ? feedUrlOf(openSecret(sealed)) : null,
      googleAvailable: googleConfigured(),
    });
  });

  router.patch('/connections/:id', async (req, res) => {
    const input = updateConnectionSchema.parse(req.body);
    const current = await getConnection(String(req.params.id), userOf(req));
    if (!current) throw notFound('Calendar connection not found');
    const calendars = input.calendars
      ? current.calendars.map((calendar) => {
          const change = input.calendars!.find((item) => item.id === calendar.id);
          return change ? { ...calendar, show: change.show, important: change.important } : calendar;
        })
      : null;
    if (
      input.defaultCalendarId &&
      !current.calendars.some((item) => item.id === input.defaultCalendarId && item.writable)
    )
      throw badRequest('Pick a calendar you can write to');
    const updated = (await updateConnection(current.id, userOf(req), calendars, input.defaultCalendarId))!;
    if (calendars?.some((calendar, index) => calendar.show !== current.calendars[index]!.show))
      await syncConnection(updated);
    res.json({ connection: toConnection((await getConnection(current.id, userOf(req)))!) });
  });

  router.post('/connections/:id/sync', limits.calendarConnect, async (req, res) => {
    const connection = await getConnection(String(req.params.id), userOf(req));
    if (!connection) throw notFound('Calendar connection not found');
    await syncConnection(connection);
    res.json({ connection: toConnection((await getConnection(connection.id, userOf(req)))!) });
  });

  router.delete('/connections/:id', async (req, res) => {
    const removed = await deleteConnection(String(req.params.id), userOf(req));
    if (!removed) throw notFound('Calendar connection not found');
    if (removed.provider === 'google')
      void revokeGoogle(JSON.parse(openSecret(removed.credentials_sealed)) as GoogleCredentials);
    res.status(204).end();
  });

  router.post('/feed', async (req, res) => {
    const token = randomToken();
    await setFeedToken(userOf(req), hashToken(token), sealSecret(token));
    res.json({ feedUrl: feedUrlOf(token) });
  });

  router.get('/google/connect', (_req, res) => {
    if (!googleConfigured()) throw new HttpError(503, 'Google Calendar is not set up on this server yet');
    const state = randomToken();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: STATE_TTL_MS,
      path: STATE_PATH,
    });
    res.redirect(googleAuthUrl(state));
  });

  router.get('/google/callback', async (req, res) => {
    const back = (result: string) => res.redirect(`${config.APP_URL}/settings/calendars?google=${result}`);
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const expected: string | undefined = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: STATE_PATH });
    if (!code || !state || !expected || state !== expected) return back('cancelled');
    try {
      const { refreshToken, email } = await exchangeGoogleCode(code);
      const connection = await upsertConnection(
        userOf(req),
        'google',
        email,
        sealSecret(JSON.stringify({ refreshToken })),
      );
      await syncConnection(connection);
      back('connected');
    } catch (err) {
      logger.warn({ err }, 'Google Calendar connection failed');
      back('failed');
    }
  });

  router.post('/icloud/connect', limits.calendarConnect, async (req, res) => {
    const { appleId, appPassword } = icloudConnectSchema.parse(req.body);
    const credentials = { username: appleId, password: appPassword.toLowerCase() };
    await icloud.listCalendars(credentials);
    const connection = await upsertConnection(
      userOf(req),
      'icloud',
      appleId,
      sealSecret(JSON.stringify(credentials)),
    );
    await syncConnection(connection);
    res.status(201).json({ connection: toConnection((await getConnection(connection.id, userOf(req)))!) });
  });

  return router;
};

export const createCalendarFeedRouter = (limits: RateLimits) => {
  const router = Router();

  router.get('/:file', limits.calendarFeed, async (req, res) => {
    const token = tokenSchema.safeParse(String(req.params.file).replace(/\.ics$/, ''));
    const userId = token.success ? await feedUserId(hashToken(token.data)) : null;
    if (!userId) throw notFound('This calendar link is no longer valid');
    res
      .type('text/calendar; charset=utf-8')
      .set('Cache-Control', 'private, max-age=300')
      .send(await buildFeed(userId));
  });

  return router;
};
