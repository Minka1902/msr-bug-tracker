import { CalendarClock, CalendarDays, MapPin, Star } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import type { CSSProperties } from 'react';
import { formatMinutes } from '@msr/shared/calendar';
import type { CalendarItem } from '@msr/shared/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../lib/cn';
import { itemDays, itemEnd, itemStart } from '../calendarDates';

interface AgendaListProps {
  items: CalendarItem[];
  from: string;
  to: string;
  onOpenItem: (item: CalendarItem) => void;
}

export function AgendaList({ items, from, to, onOpenItem }: AgendaListProps) {
  const byDay = new Map<string, CalendarItem[]>();
  items.forEach((item) =>
    itemDays(item)
      .filter((key) => key >= from && key <= to)
      .forEach((key) => byDay.set(key, [...(byDay.get(key) ?? []), item])),
  );
  const days = [...byDay.keys()].sort();

  if (!days.length)
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Nothing scheduled"
        description="Events and task deadlines show up here."
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {days.map((key) => (
        <section
          key={key}
          aria-label={format(parseISO(key), 'EEEE, MMMM d')}
          className="flex flex-col gap-1.5"
        >
          <h3
            className={cn(
              'text-xs font-semibold tracking-wide text-muted uppercase',
              isToday(parseISO(key)) && 'text-accent-text',
            )}
          >
            {isToday(parseISO(key)) ? 'Today · ' : ''}
            {format(parseISO(key), 'EEEE, MMMM d')}
          </h3>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {byDay
              .get(key)!
              .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt))
              .map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    style={{ '--c': item.color } as CSSProperties}
                    className="flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-muted/60"
                  >
                    <span className="w-14 shrink-0 pt-0.5 text-xs text-muted tabular-nums">
                      {item.allDay ? 'All day' : format(itemStart(item), 'HH:mm')}
                      {!item.allDay && <span className="block">{format(itemEnd(item), 'HH:mm')}</span>}
                    </span>
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-(--c)" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {item.important && (
                          <Star
                            className="size-3.5 shrink-0 fill-highlight text-highlight"
                            aria-label="Very important"
                          />
                        )}
                        <span className="truncate">
                          {item.taskIdentifier ? `${item.taskIdentifier} · ${item.title}` : item.title}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{item.kind === 'task' ? `Due · ${item.calendarName}` : item.calendarName}</span>
                        {item.appointment && (
                          <span className="inline-flex items-center gap-0.5">
                            <CalendarClock className="size-3" aria-hidden />
                            {formatMinutes((itemEnd(item).getTime() - itemStart(item).getTime()) / 60_000)}
                          </span>
                        )}
                        {item.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" aria-hidden /> {item.location}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
