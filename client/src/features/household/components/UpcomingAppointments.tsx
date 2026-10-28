import { format } from 'date-fns';
import { CalendarClock, MapPin } from 'lucide-react';
import { formatMinutes } from '@msr/shared/calendar';
import type { CalendarItem } from '@msr/shared/types';
import { AvatarGroup } from '../../../components/ui/AvatarGroup';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../lib/cn';
import { itemEnd, itemStart } from '../../calendar/calendarDates';

interface UpcomingAppointmentsProps {
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  className?: string;
}

export function UpcomingAppointments({ items, onOpen, className }: UpcomingAppointmentsProps) {
  if (!items.length)
    return (
      <EmptyState
        compact
        icon={<CalendarClock />}
        title="No appointments soon"
        description="Doctor, school or vet visits show up here."
      />
    );

  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-muted/60"
          >
            <span className="flex w-12 shrink-0 flex-col items-center rounded-control bg-accent-soft py-1 text-accent-text">
              <span className="text-[10px] font-semibold uppercase">{format(itemStart(item), 'EEE')}</span>
              <span className="text-sm leading-none font-bold">{format(itemStart(item), 'd')}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{item.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="tabular-nums">
                  {format(itemStart(item), 'HH:mm')} ·{' '}
                  {formatMinutes((itemEnd(item).getTime() - itemStart(item).getTime()) / 60_000)}
                </span>
                {item.location && (
                  <span className="inline-flex min-w-0 items-center gap-0.5">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{item.location}</span>
                  </span>
                )}
              </span>
            </span>
            {item.attendees.length > 0 && <AvatarGroup people={item.attendees} max={3} size="xs" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
