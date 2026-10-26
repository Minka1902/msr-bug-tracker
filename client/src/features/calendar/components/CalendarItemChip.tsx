import { CircleCheck, Star } from 'lucide-react';
import { format } from 'date-fns';
import type { CSSProperties } from 'react';
import type { CalendarItem } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { itemStart } from '../calendarDates';

interface CalendarItemChipProps {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  showTime?: boolean;
  className?: string;
}

export function CalendarItemChip({ item, onOpen, showTime = true, className }: CalendarItemChipProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      style={{ '--c': item.color } as CSSProperties}
      title={item.title}
      className={cn(
        'flex w-full min-w-0 cursor-pointer items-center gap-1 truncate rounded-md border-l-[3px] border-(--c) bg-[color-mix(in_oklab,var(--c)_14%,var(--c-surface))] px-1.5 py-0.5 text-left text-[11px] leading-4 font-medium text-text hover:bg-[color-mix(in_oklab,var(--c)_24%,var(--c-surface))]',
        item.important && 'ring-1 ring-highlight',
        className,
      )}
    >
      {item.important && (
        <Star className="size-3 shrink-0 fill-highlight text-highlight" aria-label="Very important" />
      )}
      {item.kind === 'task' && <CircleCheck className="size-3 shrink-0 text-muted" aria-hidden />}
      {showTime && !item.allDay && (
        <span className="shrink-0 text-muted tabular-nums">{format(itemStart(item), 'HH:mm')}</span>
      )}
      <span className="truncate">
        {item.taskIdentifier ? `${item.taskIdentifier} ${item.title}` : item.title}
      </span>
    </button>
  );
}
