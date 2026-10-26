import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { sealSecret } from '../src/lib/secretBox';
import {
  buildCalendarObject,
  parseCalendarObject,
  updateCalendarObject,
} from '../src/modules/calendar/icalendar';
import { syncConnection } from '../src/modules/calendar/sync';
import type { ConnectionRow } from '../src/modules/calendar/service';
import { agentFor, createTask, registerUser, resetDb, setupTeam } from './helpers';

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllGlobals();
  config.GOOGLE_CLIENT_ID = undefined;
  config.GOOGLE_CLIENT_SECRET = undefined;
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const event = (overrides: Record<string, unknown> = {}) => ({
  title: 'Board meeting',
  startsAt: '2026-11-05T10:00:00Z',
  endsAt: '2026-11-05T11:00:00Z',
  ...overrides,
});

describe('calendar events', () => {
  it('lists personal and project events with task deadlines', async () => {
    const { owner, project, member } = await setupTeam();
    await owner
      .post('/api/calendar/events')
      .send(event({ title: 'Dentist' }))
      .expect(201);
    const { body } = await owner
      .post('/api/calendar/events')
      .send(event({ title: 'Sprint review', projectKey: project.key, attendeeIds: [member.id] }))
      .expect(201);
    expect(body.event).toMatchObject({
      title: 'Sprint review',
      project: { key: 'WEB' },
      editable: true,
      source: 'app',
    });
    expect(body.event.attendees.map((person: { id: string }) => person.id)).toEqual([member.id]);
    const ownerId = (await owner.get('/api/auth/me')).body.user.id;
    await createTask(owner, project.key, { title: 'Ship it', dueDate: '2026-11-06', assigneeId: ownerId });

    const all = await owner.get('/api/calendar/events?from=2026-11-01&to=2026-11-30').expect(200);
    expect(all.body.items.map((item: { title: string; kind: string }) => [item.kind, item.title])).toEqual([
      ['event', 'Dentist'],
      ['event', 'Sprint review'],
      ['task', 'Ship it'],
    ]);
    expect(all.body.items[2]).toMatchObject({
      allDay: true,
      taskIdentifier: 'WEB-1',
      startsAt: '2026-11-06T00:00:00.000Z',
    });

    const memberView = await member.agent
      .get(`/api/calendar/events?from=2026-11-01&to=2026-11-30&projectKey=WEB`)
      .expect(200);
    expect(memberView.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Sprint review',
      'Ship it',
    ]);
    await owner.get('/api/calendar/events?from=2026-01-01&to=2027-12-31').expect(400);
  });

  it('checks who may create, edit and invite', async () => {
    const { owner, project, viewer, outsider, member } = await setupTeam();
    await outsider
      .post('/api/calendar/events')
      .send(event({ projectKey: project.key }))
      .expect(404);
    await viewer.agent
      .post('/api/calendar/events')
      .send(event({ projectKey: project.key }))
      .expect(403);
    const strangerId = (await outsider.get('/api/auth/me')).body.user.id;
    await owner
      .post('/api/calendar/events')
      .send(event({ projectKey: project.key, attendeeIds: [strangerId] }))
      .expect(400);
    await owner
      .post('/api/calendar/events')
      .send(event({ attendeeIds: [member.id] }))
      .expect(400);
    await owner
      .post('/api/calendar/events')
      .send(event({ endsAt: '2026-11-05T09:00:00Z' }))
      .expect(400);
    const personal = (await owner.post('/api/calendar/events').send(event()).expect(201)).body.event;
    await member.agent.patch(`/api/calendar/events/${personal.id}`).send({ title: 'Hijack' }).expect(404);
    const shared = (
      await owner
        .post('/api/calendar/events')
        .send(event({ projectKey: project.key }))
        .expect(201)
    ).body.event;
    await viewer.agent.patch(`/api/calendar/events/${shared.id}`).send({ title: 'Nope' }).expect(403);
    const { body } = await owner
      .patch(`/api/calendar/events/${shared.id}`)
      .send({ allDay: true, startsAt: '2026-11-07T00:00:00Z', endsAt: '2026-11-07T00:00:00Z' })
      .expect(200);
    expect(body.event).toMatchObject({
      allDay: true,
      startsAt: '2026-11-07T00:00:00.000Z',
      endsAt: '2026-11-08T00:00:00.000Z',
    });
    await owner.delete(`/api/calendar/events/${shared.id}`).expect(204);
  });
});

describe('very important conflicts', () => {
  it('warns when a deadline or meeting overlaps a very important event, without leaking private titles', async () => {
    const { owner, project, member, outsider } = await setupTeam();
    await member.agent
      .post('/api/calendar/events')
      .send(event({ title: 'Surgery', important: true }))
      .expect(201);
    await owner
      .post('/api/calendar/events')
      .send(
        event({
          title: 'Investor call',
          important: true,
          startsAt: '2026-11-05T14:00:00Z',
          endsAt: '2026-11-05T15:00:00Z',
        }),
      )
      .expect(201);
    await owner
      .post('/api/calendar/events')
      .send(event({ title: 'Lunch', startsAt: '2026-11-05T12:00:00Z', endsAt: '2026-11-05T13:00:00Z' }))
      .expect(201);

    const mine = await owner.get('/api/calendar/conflicts?date=2026-11-05').expect(200);
    expect(mine.body.conflicts.map((conflict: { title: string }) => conflict.title)).toEqual([
      'Investor call',
    ]);
    expect((await owner.get('/api/calendar/conflicts?date=2026-11-06').expect(200)).body.conflicts).toEqual(
      [],
    );

    const both = await owner.get(`/api/calendar/conflicts?date=2026-11-05&userIds=${member.id}`).expect(200);
    expect(both.body.conflicts).toEqual([
      expect.objectContaining({
        title: 'Very important event',
        calendarName: 'Private',
        personName: expect.stringMatching(/^User/),
      }),
    ]);
    const outsiderId = (await outsider.get('/api/auth/me')).body.user.id;
    expect(
      (await owner.get(`/api/calendar/conflicts?date=2026-11-05&userIds=${outsiderId}`).expect(200)).body
        .conflicts,
    ).toEqual([]);

    const meeting = await owner
      .get('/api/calendar/conflicts?startsAt=2026-11-05T14:30:00Z&endsAt=2026-11-05T16:00:00Z')
      .expect(200);
    expect(meeting.body.conflicts.map((conflict: { title: string }) => conflict.title)).toEqual([
      'Investor call',
    ]);
    const touching = await owner
      .get('/api/calendar/conflicts?startsAt=2026-11-05T15:00:00Z&endsAt=2026-11-05T16:00:00Z')
      .expect(200);
    expect(touching.body.conflicts).toEqual([]);

    const projectWide = await owner
      .post('/api/calendar/events')
      .send(
        event({
          title: 'Release freeze',
          important: true,
          projectKey: project.key,
          startsAt: '2026-11-09T00:00:00Z',
          endsAt: '2026-11-10T00:00:00Z',
          allDay: true,
        }),
      )
      .expect(201);
    const forMember = await member.agent.get('/api/calendar/conflicts?date=2026-11-09').expect(200);
    expect(
      forMember.body.conflicts.map((conflict: { id: string; title: string }) => [
        conflict.id,
        conflict.title,
      ]),
    ).toEqual([[projectWide.body.event.id, 'Release freeze']]);
  });

  it('lists upcoming clashes for my deadlines, unassigned tasks I created, and my events', async () => {
    const { owner, member, project } = await setupTeam();
    const ownerId = (await owner.get('/api/auth/me')).body.user.id;
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await owner
      .post('/api/calendar/events')
      .send(
        event({
          title: 'Wedding',
          important: true,
          startsAt: `${day}T00:00:00Z`,
          endsAt: `${day}T00:00:00Z`,
          allDay: true,
        }),
      )
      .expect(201);
    await createTask(owner, project.key, { title: 'Launch page', dueDate: day, assigneeId: ownerId });
    await createTask(owner, project.key, { title: 'Order cake', dueDate: day });
    await createTask(member.agent, project.key, { title: 'Member chore', dueDate: day });
    const { body } = await owner.get('/api/calendar/conflicts/upcoming').expect(200);
    expect(body.conflicts).toHaveLength(2);
    expect(body.conflicts).toEqual(
      expect.arrayContaining(
        ['Launch page', 'Order cake'].map((title) =>
          expect.objectContaining({
            item: expect.objectContaining({ kind: 'task', title, date: day }),
            clashes: [expect.objectContaining({ title: 'Wedding' })],
          }),
        ),
      ),
    );
  });
});

describe('calendar feed', () => {
  it('serves a private, regenerable ICS link', async () => {
    const owner = agentFor();
    await registerUser(owner);
    await owner
      .post('/api/calendar/events')
      .send(
        event({
          title: 'Team, offsite; day 1',
          important: true,
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        }),
      )
      .expect(201);
    const first = (await owner.post('/api/calendar/feed').expect(200)).body.feedUrl as string;
    expect(first).toMatch(/\/api\/calendar-feed\/[\w-]{43}\.ics$/);
    const path = new URL(first).pathname;
    const feed = await agentFor().get(path).expect(200);
    expect(feed.headers['content-type']).toContain('text/calendar');
    expect(feed.text).toContain('BEGIN:VCALENDAR');
    expect(feed.text).toContain(String.raw`SUMMARY:Team\, offsite\; day 1`);
    expect(feed.text).toContain('PRIORITY:1');
    expect((await owner.get('/api/calendar/connections').expect(200)).body.feedUrl).toBe(first);
    await owner.post('/api/calendar/feed').expect(200);
    await agentFor().get(path).expect(404);
  });
});

describe('Google Calendar sync', () => {
  it('pulls events, honours very important colours and calendar flags, and pushes edits back', async () => {
    config.GOOGLE_CLIENT_ID = 'client-id';
    config.GOOGLE_CLIENT_SECRET = 'client-secret';
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.startsWith('https://oauth2.googleapis.com/token'))
          return json(200, { access_token: 'at', expires_in: 3600 });
        if (url.includes('/calendarList'))
          return json(200, {
            items: [
              {
                id: 'primary-cal',
                summary: 'Me',
                backgroundColor: '#0b8043',
                accessRole: 'owner',
                primary: true,
              },
              { id: 'holidays', summary: 'Holidays', accessRole: 'reader', selected: true },
            ],
          });
        if (url.includes('/calendars/primary-cal/events/evt-1') && init?.method === 'PATCH')
          return json(200, { id: 'evt-1', etag: '"2"', status: 'confirmed', start: {}, end: {} });
        if (url.includes('/calendars/primary-cal/events'))
          return json(200, {
            items: [
              {
                id: 'evt-1',
                etag: '"1"',
                status: 'confirmed',
                summary: 'Flight',
                colorId: '11',
                start: { dateTime: '2026-11-05T08:00:00Z' },
                end: { dateTime: '2026-11-05T12:00:00Z' },
              },
              {
                id: 'evt-2',
                etag: '"1"',
                status: 'cancelled',
                summary: 'Gone',
                start: { date: '2026-11-06' },
                end: { date: '2026-11-07' },
              },
            ],
          });
        if (url.includes('/calendars/holidays/events'))
          return json(200, {
            items: [
              {
                id: 'h-1',
                etag: '"1"',
                status: 'confirmed',
                summary: 'National day',
                start: { date: '2026-11-11' },
                end: { date: '2026-11-12' },
              },
            ],
          });
        return json(404, {});
      }),
    );
    const agent = agentFor();
    const { user } = await registerUser(agent);
    const { rows } = await pool.query<ConnectionRow>(
      `INSERT INTO calendar_connections (user_id, provider, account_email, credentials_sealed) VALUES ($1, 'google', 'me@gmail.com', $2) RETURNING *`,
      [user.id, sealSecret(JSON.stringify({ refreshToken: 'rt' }))],
    );
    await syncConnection(rows[0]!);
    const { body } = await agent.get('/api/calendar/events?from=2026-11-01&to=2026-11-30').expect(200);
    expect(
      body.items.map((item: { title: string; source: string; important: boolean; editable: boolean }) => [
        item.title,
        item.source,
        item.important,
        item.editable,
      ]),
    ).toEqual([
      ['Flight', 'google', true, true],
      ['National day', 'google', false, false],
    ]);
    const { body: connections } = await agent.get('/api/calendar/connections').expect(200);
    expect(connections.connections[0]).toMatchObject({
      accountEmail: 'me@gmail.com',
      defaultCalendarId: 'primary-cal',
      syncError: null,
    });

    const flight = body.items[0];
    await agent.patch(`/api/calendar/events/${flight.id}`).send({ title: 'Flight to Rome' }).expect(200);
    const patch = calls.find((call) => call.init?.method === 'PATCH')!;
    expect((patch.init!.headers as Record<string, string>)['If-Match']).toBe('"1"');
    expect(JSON.parse(String(patch.init!.body))).toMatchObject({
      summary: 'Flight to Rome',
      extendedProperties: { private: { msrImportant: '1' } },
    });
    await agent.patch(`/api/calendar/events/${body.items[1].id}`).send({ title: 'Mine now' }).expect(403);

    const connectionId = connections.connections[0].id;
    await agent
      .patch(`/api/calendar/connections/${connectionId}`)
      .send({ calendars: [{ id: 'holidays', show: true, important: true }] })
      .expect(200);
    expect(
      (await agent.get('/api/calendar/conflicts?date=2026-11-11').expect(200)).body.conflicts.map(
        (c: { title: string }) => c.title,
      ),
    ).toEqual(['National day']);
    await agent
      .patch(`/api/calendar/connections/${connectionId}`)
      .send({ calendars: [{ id: 'holidays', show: false, important: true }] })
      .expect(200);
    const after = await agent.get('/api/calendar/events?from=2026-11-01&to=2026-11-30').expect(200);
    expect(after.body.items.map((item: { title: string }) => item.title)).toEqual(['Flight']);
    await agent.delete(`/api/calendar/connections/${connectionId}`).expect(204);
    expect((await pool.query('SELECT count(*)::int AS n FROM calendar_events')).rows[0].n).toBe(0);
  });
});

describe('iCalendar objects', () => {
  const draft = {
    title: 'Parent meeting',
    description: 'Room 4',
    location: 'School',
    startsAt: '2026-11-05T15:00:00.000Z',
    endsAt: '2026-11-05T16:00:00.000Z',
    allDay: false,
    important: true,
  };
  const window = [new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z')] as const;

  it('round-trips events and updates only the master event', () => {
    const ics = buildCalendarObject('uid-1', draft);
    expect(parseCalendarObject(ics, 'https://cal/1.ics', 'cal', '"e"', false, ...window)).toEqual([
      { ...draft, calendarId: 'cal', externalId: 'https://cal/1.ics', etag: '"e"', readOnly: false },
    ]);
    const updated = updateCalendarObject(ics, {
      ...draft,
      title: 'Moved meeting',
      important: false,
      allDay: true,
      startsAt: '2026-11-06T00:00:00.000Z',
      endsAt: '2026-11-07T00:00:00.000Z',
    });
    expect(updated).toContain('UID:uid-1');
    expect(updated).toContain('DTSTART;VALUE=DATE:20261106');
    expect(updated).not.toContain('PRIORITY');
  });

  it('expands recurring events inside the window as read-only occurrences', () => {
    const recurring = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:test',
      'BEGIN:VEVENT',
      'UID:r1',
      'DTSTAMP:20261001T000000Z',
      'DTSTART:20261030T090000Z',
      'DTEND:20261030T093000Z',
      'RRULE:FREQ=WEEKLY;COUNT=4',
      'SUMMARY:Standup',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const occurrences = parseCalendarObject(recurring, 'https://cal/r1.ics', 'cal', null, false, ...window);
    expect(occurrences.map((item) => item.startsAt)).toEqual([
      '2026-11-06T09:00:00.000Z',
      '2026-11-13T09:00:00.000Z',
      '2026-11-20T09:00:00.000Z',
    ]);
    expect(
      occurrences.every((item) => item.readOnly && item.externalId.startsWith('https://cal/r1.ics#')),
    ).toBe(true);
  });
});
