import { Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { workflowOf } from '@msr/shared/enums';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { Checkbox } from '../../../components/ui/Checkbox';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useReopenTask, useUpdateTask } from '../../tasks/api';
import { DueDate } from '../../tasks/components/DueDate';
import { TypeIcon } from '../../tasks/taskMeta';

interface ChoreCheckRowProps {
  task: TaskCard;
  project: ProjectDetail;
  onOpen: (task: TaskCard) => void;
  className?: string;
}

export function ChoreCheckRow({ task, project, onOpen, className }: ChoreCheckRowProps) {
  const toggle = (checked: boolean) => {
    const onError = (error: Error) => toast.error(errorMessage(error));
    if (!checked) return reopen.mutate(task.id, { onError });
    const done = project.statuses.find(
      (status) => status.workflow === workflowOf(task.type) && status.category === 'done',
    );
    if (done)
      update
        .mutateAsync({
          id: task.id,
          patch: { statusId: done.id },
          optimistic: { statusId: done.id, statusCategory: 'done' },
        })
        .then(
          () => task.recurrence && toast.success(`Nice! The next "${task.title}" is on the list`),
          onError,
        );
  };

  const permissions = useProjectPermissions(project);
  const update = useUpdateTask();
  const reopen = useReopenTask();
  const done = task.statusCategory === 'done';

  return (
    <div
      className={cn(
        'flex min-h-10 items-center gap-2.5 rounded-control px-2 hover:bg-surface-muted/60',
        className,
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={toggle}
        disabled={!permissions.canTransition({ assigneeId: task.assignee?.id ?? null })}
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm"
      >
        <TypeIcon type={task.type} className="size-3.5" />
        <span className={cn('min-w-0 flex-1 truncate', done && 'text-muted line-through')}>{task.title}</span>
        {task.recurrence && <Repeat className="size-3.5 shrink-0 text-subtle" aria-label="Repeats" />}
        {task.dueDate && <DueDate date={task.dueDate} done={done} className="shrink-0" />}
      </button>
    </div>
  );
}
