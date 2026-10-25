import { Ban } from 'lucide-react';
import type { ProjectStatus, TaskCard } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/cn';
import { PriorityIcon, TypeIcon } from '../taskMeta';
import { DueDate } from './DueDate';

interface TaskRowCardProps {
  task: TaskCard;
  status?: ProjectStatus;
  onOpen: (task: TaskCard) => void;
  showProject?: boolean;
  className?: string;
}

export function TaskRowCard({ task, status, onOpen, showProject, className }: TaskRowCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-2 rounded-control border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-xs text-subtle">
        <TypeIcon type={task.type} className="size-3.5" />
        <span className="font-mono">{showProject ? task.identifier : `#${task.number}`}</span>
        {status && (
          <Badge size="xs" variant="dot" color={status.color} label={status.name} className="ml-auto" />
        )}
      </span>
      <span
        className={cn(
          'line-clamp-2 text-sm font-medium',
          task.statusCategory === 'done' && 'text-muted line-through',
        )}
      >
        {task.title}
      </span>
      <span className="flex items-center gap-3">
        <PriorityIcon priority={task.priority} />
        {task.isBlocked && <Ban className="size-3.5 text-danger" />}
        {task.dueDate && <DueDate date={task.dueDate} done={task.statusCategory === 'done'} />}
        <span className="flex-1" />
        {task.assignee && <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />}
      </span>
    </button>
  );
}
