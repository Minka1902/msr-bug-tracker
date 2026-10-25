import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskCard } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { TaskCardView } from '../components/TaskCardView';

interface SortableTaskCardProps {
  task: TaskCard;
  containerId: string;
  disabled?: boolean;
  onOpen: (task: TaskCard) => void;
}

export function SortableTaskCard({ task, containerId, disabled, onOpen }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { containerId },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-[calc(var(--r-card)-4px)] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
      aria-label={`${task.identifier}: ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && !isDragging) onOpen(task);
      }}
    >
      <TaskCardView task={task} />
    </div>
  );
}
