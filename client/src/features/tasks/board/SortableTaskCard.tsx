import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskCard } from '@msr/shared/types';
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
      className={isDragging ? 'opacity-40' : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCardView task={task} onOpen={onOpen} />
    </div>
  );
}
