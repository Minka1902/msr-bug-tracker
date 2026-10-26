import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TaskType } from '@msr/shared/enums';
import type { CreateTaskInput } from '@msr/shared/schemas/task';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import { InlineTaskComposer } from './InlineTaskComposer';
import { SortableTaskCard } from './SortableTaskCard';

interface BoardCellProps {
  id: string;
  label: string;
  project: ProjectDetail;
  tasks: TaskCard[];
  hiddenCount?: number;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  composer?: Omit<CreateTaskInput, 'title'> | null;
  composerTypes: readonly TaskType[];
  canDrag?: (task: TaskCard) => boolean;
  swipe?: boolean;
  onOpen: (task: TaskCard) => void;
}

export function BoardCell({
  id,
  label,
  project,
  tasks,
  hiddenCount = 0,
  loadingMore,
  onLoadMore,
  composer,
  composerTypes,
  canDrag,
  swipe,
  onOpen,
}: BoardCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { containerId: id } });

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2.5 rounded-card p-1 transition-colors max-md:w-full max-lg:snap-start md:max-lg:w-[calc((100vw-8rem)/2)]',
        isOver && 'bg-accent-soft/50',
      )}
    >
      <SortableContext id={id} items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            containerId={id}
            disabled={canDrag ? !canDrag(task) : false}
            swipe={swipe}
            onOpen={onOpen}
          />
        ))}
      </SortableContext>
      {hiddenCount > 0 && onLoadMore && (
        <Button size="xs" variant="ghost" loading={loadingMore} onClick={onLoadMore}>
          Show {hiddenCount} more
        </Button>
      )}
      {composer && <InlineTaskComposer project={project} defaults={composer} types={composerTypes} />}
    </div>
  );
}
