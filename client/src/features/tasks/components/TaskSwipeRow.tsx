import { CircleCheck, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { TaskCard } from '@msr/shared/types';
import { SwipeRow } from '../../../components/ui/SwipeRow';
import { errorMessage } from '../../../lib/api';
import { useBulkUpdate, useReopenTask } from '../api';
import { TaskQuickActions } from './TaskQuickActions';

interface TaskSwipeRowProps {
  task: TaskCard;
  children: ReactNode;
  className?: string;
}

export function TaskSwipeRow({ task, children, className }: TaskSwipeRowProps) {
  const complete = () =>
    bulkUpdate.mutate(
      { ids: [task.id], patch: { statusCategory: 'done' } },
      {
        onSuccess: () =>
          toast.success(`${task.identifier} done`, { action: { label: 'Undo', onClick: reopen } }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const reopen = () =>
    reopenTask.mutate(task.id, {
      onSuccess: () => toast.success(`${task.identifier} reopened`),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const bulkUpdate = useBulkUpdate(task.projectKey);
  const reopenTask = useReopenTask();
  const [actionsOpen, setActionsOpen] = useState(false);
  const done = task.statusCategory === 'done';

  return (
    <>
      <SwipeRow
        className={className}
        primary={
          done
            ? { label: 'Reopen', icon: <RotateCcw />, color: 'var(--tone-info)', onAction: reopen }
            : { label: 'Done', icon: <CircleCheck />, color: 'var(--tone-success)', onAction: complete }
        }
        secondary={{
          label: 'Actions',
          icon: <SlidersHorizontal />,
          color: 'var(--tone-accent)',
          onAction: () => setActionsOpen(true),
        }}
      >
        {children}
      </SwipeRow>
      {actionsOpen && <TaskQuickActions task={task} open={actionsOpen} onOpenChange={setActionsOpen} />}
    </>
  );
}
