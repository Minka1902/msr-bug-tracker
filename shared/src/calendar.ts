export interface TimeSpan {
  start: number;
  end: number;
}

export interface CalendarRange {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export const REMINDER_MAX_MINUTES = 10_080;
export const REMINDER_PRESETS = [2880, 1440, 120, 60, 30, 15];
export const DEFAULT_REMINDERS = [1440, 60];
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

const DAY_MS = 86_400_000;
const MIN_SPAN_MS = 60_000;

const zoneOffset = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)!.value);
  const local = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return local - Math.floor(instant / 1000) * 1000;
};

export const formatMinutes = (minutes: number) => {
  if (minutes >= 1440 && minutes % 1440 === 0) return minutes === 1440 ? '1 day' : `${minutes / 1440} days`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const addDays = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const zonedMidnight = (isoDate: string, timeZone: string) => {
  const utcMidnight = Date.parse(`${isoDate}T00:00:00Z`);
  const first = utcMidnight - zoneOffset(utcMidnight, timeZone);
  return utcMidnight - zoneOffset(first, timeZone);
};

export const dateSpan = (
  isoDate: string,
  timeZone: string,
  endExclusive = addDays(isoDate, 1),
): TimeSpan => ({
  start: zonedMidnight(isoDate, timeZone),
  end: zonedMidnight(endExclusive, timeZone),
});

export const rangeSpan = (range: CalendarRange, timeZone: string): TimeSpan => {
  if (range.allDay) return dateSpan(range.startsAt.slice(0, 10), timeZone, range.endsAt.slice(0, 10));
  const start = Date.parse(range.startsAt);
  return { start, end: Math.max(Date.parse(range.endsAt), start + MIN_SPAN_MS) };
};

export const spansOverlap = (a: TimeSpan, b: TimeSpan) => a.start < b.end && b.start < a.end;
