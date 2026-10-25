import { Ban, CheckSquare, GitBranch, MessageSquare, Paperclip } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { PRIORITY_META } from '@msr/shared/enums';
import type { TaskCard } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { PriorityIcon, TypeIcon } from '../taskMeta';
import { DueDate } from './DueDate';

interface TaskCardViewProps extends Omit<ComponentProps<'div'>, 'onClick'> {
  task: TaskCard;
  onOpen?: (task: TaskCard) => void;
  showProject?: boolean;
  dragging?: boolean;
}

const Counter = ({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) => (
  <span title={label} className="inline-flex items-center gap-1 text-xs text-muted [&_svg]:size-3.5">
    {icon}
    {value}
  </span>
);

export function TaskCardView({
  task,
  onOpen,
  showProject,
  dragging,
  className,
  ...props
}: TaskCardViewProps) {
  const done = task.statusCategory === 'done';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(task)}
      onKeyDown={(event) => event.key === 'Enter' && onOpen?.(task)}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-[calc(var(--r-card)-4px)] border border-border/70 bg-surface-raised text-left shadow-card transition-[box-shadow,border-color,transform] outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'rotate-2 shadow-pop',
        className,
      )}
      {...props}
    >
      {task.coverUrl && (
        <img
          src={task.coverUrl}
          alt=""
          loading="lazy"
          className="aspect-[16/7] w-full border-b border-border object-cover"
        />
      )}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="plain"
            size="xs"
            tone={PRIORITY_META[task.priority].tone}
            icon={<PriorityIcon priority={task.priority} />}
            className="px-0 font-semibold"
          >
            {PRIORITY_META[task.priority].label}
          </Badge>
          {task.isBlocked && <Badge tone="danger" size="xs" icon={<Ban />} label="Blocked" />}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-subtle">
            <TypeIcon type={task.type} className="size-3.5" />
            {showProject ? task.identifier : `#${task.number}`}
          </span>
        </div>
        <p className={cn('line-clamp-3 text-sm leading-snug font-medium', done && 'text-muted line-through')}>
          {task.title}
        </p>
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((label) => (
              <Badge key={label.id} color={label.color} size="xs" label={label.name} />
            ))}
            {task.labels.length > 3 && <Badge size="xs" label={`+${task.labels.length - 3}`} />}
          </div>
        )}
        <div className="flex items-center gap-3">
          {task.dueDate && <DueDate date={task.dueDate} done={done} />}
          {task.subtaskTotal > 0 && (
            <Counter
              icon={<GitBranch />}
              value={`${task.subtaskDone}/${task.subtaskTotal}`}
              label="Subtasks"
            />
          )}
          {task.checklistTotal > 0 && (
            <Counter
              icon={<CheckSquare />}
              value={`${task.checklistDone}/${task.checklistTotal}`}
              label="Checklist"
            />
          )}
          {task.commentCount > 0 && (
            <Counter icon={<MessageSquare />} value={task.commentCount} label="Comments" />
          )}
          {task.attachmentCount > 0 && (
            <Counter icon={<Paperclip />} value={task.attachmentCount} label="Attachments" />
          )}
          <span className="flex-1" />
          {task.assignee && <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />}
        </div>
      </div>
    </div>
  );
}
