import { describe, expect, it } from 'vitest';
import { addDays, dateSpan, rangeSpan, spansOverlap, zonedMidnight } from '../src/calendar';

const deadline = (date: string, zone: string) => dateSpan(date, zone);
const meeting = (startsAt: string, endsAt: string) => rangeSpan({ startsAt, endsAt, allDay: false }, 'UTC');

describe('calendar overlap rules', () => {
  it('treats a deadline as the whole day in the assignee timezone', () => {
    const day = deadline('2026-11-05', 'Asia/Jerusalem');
    expect(spansOverlap(day, meeting('2026-11-05T10:00:00Z', '2026-11-05T11:00:00Z'))).toBe(true);
    expect(spansOverlap(day, meeting('2026-11-04T22:30:00Z', '2026-11-04T23:00:00Z'))).toBe(true);
    expect(spansOverlap(day, meeting('2026-11-04T21:30:00Z', '2026-11-04T21:59:00Z'))).toBe(false);
  });

  it('does not count events that only touch at the boundary', () => {
    const day = deadline('2026-11-05', 'UTC');
    expect(spansOverlap(day, meeting('2026-11-04T23:00:00Z', '2026-11-05T00:00:00Z'))).toBe(false);
    expect(spansOverlap(day, meeting('2026-11-06T00:00:00Z', '2026-11-06T01:00:00Z'))).toBe(false);
    expect(
      spansOverlap(
        meeting('2026-11-05T09:00:00Z', '2026-11-05T10:00:00Z'),
        meeting('2026-11-05T10:00:00Z', '2026-11-05T11:00:00Z'),
      ),
    ).toBe(false);
  });

  it('keeps all-day events on their dates and gives zero-length events a minute', () => {
    const allDay = rangeSpan(
      { startsAt: '2026-11-05T00:00:00Z', endsAt: '2026-11-07T00:00:00Z', allDay: true },
      'America/New_York',
    );
    expect(spansOverlap(allDay, deadline('2026-11-06', 'America/New_York'))).toBe(true);
    expect(spansOverlap(allDay, deadline('2026-11-07', 'America/New_York'))).toBe(false);
    const reminder = meeting('2026-11-05T12:00:00Z', '2026-11-05T12:00:00Z');
    expect(reminder.end - reminder.start).toBe(60_000);
  });

  it('finds local midnight across daylight-saving changes', () => {
    expect(new Date(zonedMidnight('2026-03-08', 'America/New_York')).toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(new Date(zonedMidnight('2026-03-09', 'America/New_York')).toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    expect(new Date(zonedMidnight('2026-10-25', 'Europe/Berlin')).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    );
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
