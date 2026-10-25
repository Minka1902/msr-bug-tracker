import { Clock } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { dueState, formatDue } from '../../../lib/dates';

const STATE_CLASS = {
  overdue: 'text-danger font-medium',
  today: 'text-warning font-medium',
  soon: 'text-text',
  later: 'text-muted',
  done: 'text-subtle line-through',
};

interface DueDateProps {
  date: string;
  done?: boolean;
  icon?: boolean;
  className?: string;
}

export function DueDate({ date, done, icon = true, className }: DueDateProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs whitespace-nowrap', STATE_CLASS[dueState(date, done)], className)}>
      {icon && <Clock className="size-3.5" />}
      {formatDue(date)}
    </span>
  );
}
