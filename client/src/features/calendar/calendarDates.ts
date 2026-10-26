import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns';
import type { CalendarItem } from '@msr/shared/types';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const FALLBACK_WEEK_START = 0;

export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const weekStartsOn = (): WeekStart => {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    return firstDay ? ((firstDay % 7) as WeekStart) : FALLBACK_WEEK_START;
  } catch {
    return FALLBACK_WEEK_START;
  }
};

export const itemStart = (item: Pick<CalendarItem, 'startsAt' | 'allDay'>) =>
  item.allDay ? parseISO(item.startsAt.slice(0, 10)) : new Date(item.startsAt);

export const itemEnd = (item: Pick<CalendarItem, 'endsAt' | 'allDay'>) =>
  item.allDay ? parseISO(item.endsAt.slice(0, 10)) : new Date(item.endsAt);

export const itemDays = (item: Pick<CalendarItem, 'startsAt' | 'endsAt' | 'allDay'>) => {
  const start = itemStart(item);
  const last = item.allDay
    ? addDays(itemEnd(item), -1)
    : new Date(Math.max(itemEnd(item).getTime() - 1, start.getTime()));
  return eachDayOfInterval({ start, end: last < start ? start : last }).map(dayKey);
};

export const formatWhen = (item: Pick<CalendarItem, 'startsAt' | 'endsAt' | 'allDay'>) => {
  if (item.allDay) {
    const days = itemDays(item);
    const first = format(parseISO(days[0]!), 'EEE, MMM d');
    return days.length > 1
      ? `${first} – ${format(parseISO(days.at(-1)!), 'EEE, MMM d')}`
      : `${first} · all day`;
  }
  return `${format(itemStart(item), 'EEE, MMM d · HH:mm')}–${format(itemEnd(item), 'HH:mm')}`;
};

export const toLocalInputs = (iso: string, allDay: boolean) => {
  const date = allDay ? parseISO(iso.slice(0, 10)) : new Date(iso);
  return { date: format(date, 'yyyy-MM-dd'), time: format(date, 'HH:mm') };
};

export const fromLocalInputs = (date: string, time: string) =>
  new Date(`${date}T${time || '00:00'}`).toISOString();

export interface DaySegment {
  item: CalendarItem;
  startMinute: number;
  endMinute: number;
  lane: number;
  lanes: number;
}

const DAY_MINUTES = 1440;
const MIN_SEGMENT_MINUTES = 20;

export const layoutDay = (items: CalendarItem[], day: Date): DaySegment[] => {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + DAY_MINUTES * 60_000;
  const segments = items
    .filter((item) => !item.allDay)
    .map((item) => {
      const start = Math.max(itemStart(item).getTime(), dayStart);
      const end = Math.min(itemEnd(item).getTime(), dayEnd);
      const startMinute = Math.round((start - dayStart) / 60_000);
      return {
        item,
        startMinute,
        endMinute: Math.max(Math.round((end - dayStart) / 60_000), startMinute + MIN_SEGMENT_MINUTES),
        lane: 0,
        lanes: 1,
      };
    })
    .filter((segment) => segment.startMinute < DAY_MINUTES)
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
  let cluster: DaySegment[] = [];
  let laneEnds: number[] = [];
  const close = () => cluster.forEach((segment) => (segment.lanes = laneEnds.length));
  for (const segment of segments) {
    if (cluster.length && segment.startMinute >= Math.max(...laneEnds)) {
      close();
      cluster = [];
      laneEnds = [];
    }
    const free = laneEnds.findIndex((end) => end <= segment.startMinute);
    segment.lane = free === -1 ? laneEnds.length : free;
    laneEnds[segment.lane] = segment.endMinute;
    cluster.push(segment);
  }
  close();
  return segments;
};
