import { eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from 'date-fns';
import { Star } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { CalendarItem } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { dayKey, itemDays, layoutDay, type WeekStart } from '../calendarDates';
import { CalendarItemChip } from './CalendarItemChip';

interface WeekGridProps {
  anchor: Date;
  items: CalendarItem[];
  weekStartsOn: WeekStart;
  hourHeight?: number;
  scrollToHour?: number;
  onOpenItem: (item: CalendarItem) => void;
  onCreate: (date: string, time?: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function WeekGrid({
  anchor,
  items,
  weekStartsOn,
  hourHeight = 48,
  scrollToHour = 7,
  onOpenItem,
  onCreate,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn }),
    end: endOfWeek(anchor, { weekStartsOn }),
  });
  const allDay = items.filter((item) => item.allDay);
  const minuteHeight = hourHeight / 60;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollToHour * hourHeight });
  }, [scrollToHour, hourHeight]);

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-muted/60">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="flex flex-col items-center gap-0.5 border-l border-border px-1 py-1.5"
          >
            <span className="text-[11px] font-medium text-muted">{format(day, 'EEE')}</span>
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-sm tabular-nums',
                isToday(day) && 'bg-accent font-semibold text-accent-contrast',
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        ))}
        <div className="self-center px-1 text-[10px] text-subtle">all day</div>
        {days.map((day) => (
          <div
            key={`all-${day.toISOString()}`}
            className="flex min-h-7 flex-col gap-0.5 border-t border-l border-border p-0.5"
          >
            {allDay
              .filter((item) => itemDays(item).includes(dayKey(day)))
              .map((item) => (
                <CalendarItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpenItem} />
              ))}
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="max-h-[38rem] overflow-y-auto scrollbar-thin">
        <div className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
          <div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: hourHeight }}
                className="pr-1 text-right text-[10px] text-subtle tabular-nums"
              >
                {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day.toISOString()} className="relative border-l border-border">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  aria-label={`New event ${format(day, 'EEEE')} at ${hour}:00`}
                  style={{ height: hourHeight }}
                  onClick={() => onCreate(dayKey(day), `${String(hour).padStart(2, '0')}:00`)}
                  className="block w-full cursor-pointer border-b border-border/60 hover:bg-surface-muted/40"
                />
              ))}
              {layoutDay(items, day).map((segment) => (
                <button
                  key={`${segment.item.kind}-${segment.item.id}`}
                  type="button"
                  onClick={() => onOpenItem(segment.item)}
                  style={
                    {
                      '--c': segment.item.color,
                      top: segment.startMinute * minuteHeight,
                      height: (segment.endMinute - segment.startMinute) * minuteHeight - 2,
                      left: `calc(${(segment.lane / segment.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / segment.lanes}% - 4px)`,
                    } as CSSProperties
                  }
                  className="absolute flex cursor-pointer flex-col overflow-hidden rounded-md border-l-[3px] border-(--c) bg-[color-mix(in_oklab,var(--c)_18%,var(--c-surface))] px-1.5 py-0.5 text-left text-[11px] leading-4 shadow-xs hover:bg-[color-mix(in_oklab,var(--c)_28%,var(--c-surface))]"
                >
                  <span className="flex items-center gap-1 truncate font-medium">
                    {segment.item.important && (
                      <Star
                        className="size-3 shrink-0 fill-highlight text-highlight"
                        aria-label="Very important"
                      />
                    )}
                    {segment.item.title}
                  </span>
                  <span className="truncate text-muted tabular-nums">
                    {format(new Date(segment.item.startsAt), 'HH:mm')}–
                    {format(new Date(segment.item.endsAt), 'HH:mm')}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
