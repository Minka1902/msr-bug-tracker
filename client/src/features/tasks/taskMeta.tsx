import { Bug, CircleCheck, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { PRIORITY_META, TYPE_META, type Priority, type TaskType } from '@msr/shared/enums';
import { cn } from '../../lib/cn';

export const TYPE_ICONS: Record<TaskType, LucideIcon> = {
  task: CircleCheck,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
};

const PRIORITY_BARS: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const style = { '--c': `var(--tone-${PRIORITY_META[priority].tone})` } as CSSProperties;

  return (
    <span role="img" aria-label={`${PRIORITY_META[priority].label} priority`} style={style} className={cn('inline-flex h-3 items-end gap-px', className)}>
      {[1, 2, 3, 4].map((bar) => (
        <span key={bar} className={cn('w-[3px] rounded-[1px]', bar <= PRIORITY_BARS[priority] ? 'bg-(--c)' : 'bg-border-strong')} style={{ height: `${bar * 25}%` }} />
      ))}
    </span>
  );
}

export function TypeIcon({ type, className }: { type: TaskType; className?: string }) {
  const Icon = TYPE_ICONS[type];
  const style = { '--c': `var(--tone-${TYPE_META[type].tone})` } as CSSProperties;
  return <Icon aria-label={TYPE_META[type].label} style={style} className={cn('size-4 shrink-0 tint', className)} />;
}
