import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { TaskCard } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { TaskCardView } from '../components/TaskCardView';
import { TaskSwipeRow } from '../components/TaskSwipeRow';

interface SortableTaskCardProps {
  task: TaskCard;
  containerId: string;
  disabled?: boolean;
  swipe?: boolean;
  selecting?: boolean;
  selected?: boolean;
  onSelect?: (task: TaskCard, range: boolean) => void;
  onOpen: (task: TaskCard) => void;
}

export function SortableTaskCard({
  task,
  containerId,
  disabled,
  swipe,
  selecting,
  selected,
  onSelect,
  onOpen,
}: SortableTaskCardProps) {
  const click = (event: MouseEvent) => {
    if (onSelect && (selecting || event.metaKey || event.ctrlKey)) onSelect(task, event.shiftKey);
    else onOpen(task);
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { containerId },
    disabled: disabled || selecting,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative rounded-[calc(var(--r-card)-4px)] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
        selected && 'ring-2 ring-accent',
      )}
      {...attributes}
      {...listeners}
      aria-label={`${task.identifier}: ${task.title}`}
      aria-pressed={selecting ? !!selected : undefined}
      aria-disabled={selecting ? undefined : attributes['aria-disabled']}
      onClick={click}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key !== 'Enter' || isDragging) return;
        if (selecting && onSelect) onSelect(task, event.shiftKey);
        else onOpen(task);
      }}
    >
      {selecting && (
        <span
          aria-hidden
          className={cn(
            'absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-md border border-border-strong bg-surface [&_svg]:size-3.5',
            selected && 'border-accent bg-accent text-accent-contrast',
          )}
        >
          {selected && <Check />}
        </span>
      )}
      {swipe && !selecting ? (
        <TaskSwipeRow task={task} className="rounded-[calc(var(--r-card)-4px)]">
          <TaskCardView task={task} />
        </TaskSwipeRow>
      ) : (
        <TaskCardView task={task} />
      )}
    </div>
  );
}
