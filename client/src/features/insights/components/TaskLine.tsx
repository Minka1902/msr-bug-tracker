import type { ReactNode } from 'react';
import { Ban } from 'lucide-react';
import type { TaskCard } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { cn } from '../../../lib/cn';
import { DueDate } from '../../tasks/components/DueDate';
import { PriorityIcon, TypeIcon } from '../../tasks/taskMeta';

interface TaskLineProps {
  task: TaskCard;
  onOpen: (task: TaskCard) => void;
  showAssignee?: boolean;
  trailing?: ReactNode;
}

export function TaskLine({ task, onOpen, showAssignee = true, trailing }: TaskLineProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="flex w-full min-w-0 tap-size cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
    >
      <PriorityIcon priority={task.priority} className="shrink-0" />
      <TypeIcon type={task.type} className="size-3.5" />
      <span className="shrink-0 font-mono text-xs text-subtle">{task.identifier}</span>
      <span
        className={cn('min-w-0 flex-1 truncate', task.statusCategory === 'done' && 'text-muted line-through')}
      >
        {task.title}
      </span>
      {task.isBlocked && <Ban className="size-3.5 shrink-0 text-danger" aria-label="Blocked" />}
      {trailing}
      {task.dueDate && (
        <DueDate date={task.dueDate} done={task.statusCategory === 'done'} className="shrink-0" />
      )}
      {showAssignee && task.assignee && (
        <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="xs" />
      )}
    </button>
  );
}
