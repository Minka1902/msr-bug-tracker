import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarItem } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { dayKey, itemDays, type WeekStart } from '../calendarDates';
import { CalendarItemChip } from './CalendarItemChip';

interface MonthGridProps {
  anchor: Date;
  items: CalendarItem[];
  weekStartsOn: WeekStart;
  maxPerDay?: number;
  onOpenItem: (item: CalendarItem) => void;
  onCreate: (date: string) => void;
  onShowDay: (date: Date) => void;
}

export function MonthGrid({
  anchor,
  items,
  weekStartsOn,
  maxPerDay = 3,
  onOpenItem,
  onCreate,
  onShowDay,
}: MonthGridProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn }),
  });
  const byDay = new Map<string, CalendarItem[]>();
  items.forEach((item) => itemDays(item).forEach((key) => byDay.set(key, [...(byDay.get(key) ?? []), item])));

  return (
    <div
      role="grid"
      aria-label={format(anchor, 'MMMM yyyy')}
      className="overflow-hidden rounded-card border border-border"
    >
      <div role="row" className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.toISOString()}
            role="columnheader"
            className="px-2 py-1.5 text-xs font-medium text-muted"
          >
            {format(day, 'EEE')}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const dayItems = (byDay.get(key) ?? []).sort(
            (a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt),
          );
          return (
            <div
              key={key}
              role="gridcell"
              aria-label={format(day, 'EEEE, MMMM d')}
              onClick={() => onCreate(key)}
              className={cn(
                'flex min-h-24 cursor-pointer flex-col gap-0.5 border-r border-b border-border p-1 transition-colors hover:bg-surface-muted/40 [&:nth-child(7n)]:border-r-0',
                !isSameMonth(day, anchor) && 'bg-surface-muted/30 text-subtle',
              )}
            >
              <span
                className={cn(
                  'mb-0.5 flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums',
                  isToday(day) && 'bg-accent font-semibold text-accent-contrast',
                )}
              >
                {format(day, 'd')}
              </span>
              {dayItems.slice(0, maxPerDay).map((item) => (
                <CalendarItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpenItem} />
              ))}
              {dayItems.length > maxPerDay && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowDay(day);
                  }}
                  className="cursor-pointer rounded px-1.5 text-left text-[11px] font-medium text-accent-text hover:underline"
                >
                  +{dayItems.length - maxPerDay} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
