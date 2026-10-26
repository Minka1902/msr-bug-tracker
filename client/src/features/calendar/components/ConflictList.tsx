import { CalendarClock, Star } from 'lucide-react';
import type { CalendarConflict } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { formatWhen } from '../calendarDates';

interface ConflictListProps {
  conflicts: CalendarConflict[];
  showPerson?: boolean;
  className?: string;
}

export function ConflictList({ conflicts, showPerson = true, className }: ConflictListProps) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {conflicts.map((conflict) => (
        <li
          key={conflict.id}
          className="flex items-start gap-2.5 rounded-control border border-border bg-surface-muted/50 p-2.5 text-sm"
        >
          <Star className="mt-0.5 size-4 shrink-0 fill-highlight text-highlight" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text">{conflict.title}</span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <CalendarClock className="size-3.5" aria-hidden />
              {formatWhen(conflict)}
              {conflict.calendarName && ` · ${conflict.calendarName}`}
              {showPerson && conflict.personName && ` · ${conflict.personName}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
