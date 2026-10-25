import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CreateTaskInput } from '@msr/shared/schemas/task';
import type { TaskCard } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import { InlineTaskComposer } from './InlineTaskComposer';
import { SortableTaskCard } from './SortableTaskCard';

interface BoardCellProps {
  id: string;
  projectKey: string;
  tasks: TaskCard[];
  hiddenCount?: number;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  composer?: Omit<CreateTaskInput, 'title'> | null;
  dragDisabled?: boolean;
  onOpen: (task: TaskCard) => void;
}

export function BoardCell({
  id,
  projectKey,
  tasks,
  hiddenCount = 0,
  loadingMore,
  onLoadMore,
  composer,
  dragDisabled,
  onOpen,
}: BoardCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { containerId: id } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2.5 rounded-card p-1 transition-colors max-md:w-[82vw] max-md:snap-start',
        isOver && 'bg-accent-soft/50',
      )}
    >
      <SortableContext id={id} items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            containerId={id}
            disabled={dragDisabled}
            onOpen={onOpen}
          />
        ))}
      </SortableContext>
      {hiddenCount > 0 && onLoadMore && (
        <Button size="xs" variant="ghost" loading={loadingMore} onClick={onLoadMore}>
          Show {hiddenCount} more
        </Button>
      )}
      {composer && <InlineTaskComposer projectKey={projectKey} defaults={composer} />}
    </div>
  );
}
