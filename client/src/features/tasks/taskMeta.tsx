import {
  Bug,
  CircleCheck,
  MessagesSquare,
  ShoppingBag,
  Sparkles,
  SprayCan,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { isTaskType, PRIORITY_META, TYPE_META, type Priority, type TaskType } from '@msr/shared/enums';
import type { CardType, CardTypeRef } from '@msr/shared/types';
import { ProjectIcon } from '../../components/ui/ProjectIcon';
import { cn } from '../../lib/cn';

export const TYPE_ICONS: Record<TaskType, LucideIcon> = {
  task: CircleCheck,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  chore: SprayCan,
  errand: ShoppingBag,
  discussion: MessagesSquare,
};

const PRIORITY_BARS: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

interface Typed {
  type: TaskType;
  cardType?: CardTypeRef | null;
}

export const typeValue = (task: Typed) => task.cardType?.id ?? task.type;

export const typeLabel = (task: Typed) => task.cardType?.name ?? TYPE_META[task.type].label;

export const typeChange = (value: string, cardTypes: readonly CardType[]) => {
  if (isTaskType(value))
    return { input: { type: value, cardTypeId: null }, optimistic: { type: value, cardType: null } };
  const { id, name, icon, color, base } = cardTypes.find((item) => item.id === value)!;
  return {
    input: { type: base, cardTypeId: id },
    optimistic: { type: base, cardType: { id, name, icon, color } },
  };
};

interface PriorityIconProps {
  priority: Priority;
  className?: string;
  decorative?: boolean;
}

export function PriorityIcon({ priority, className, decorative }: PriorityIconProps) {
  const style = { '--c': `var(--tone-${PRIORITY_META[priority].tone})` } as CSSProperties;

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${PRIORITY_META[priority].label} priority`}
      aria-hidden={decorative || undefined}
      style={style}
      className={cn('inline-flex h-3 items-end gap-px', className)}
    >
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[3px] rounded-[1px]',
            bar <= PRIORITY_BARS[priority] ? 'bg-(--c)' : 'bg-border-strong',
          )}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  );
}

export function TypeIcon({ type, cardType, className }: Typed & { className?: string }) {
  const Icon = TYPE_ICONS[type];
  const style = { '--c': `var(--tone-${TYPE_META[type].tone})` } as CSSProperties;
  if (cardType)
    return (
      <ProjectIcon
        name={cardType.icon}
        role="img"
        aria-label={cardType.name}
        style={{ color: cardType.color }}
        className={cn('size-4 shrink-0', className)}
      />
    );
  return (
    <Icon
      aria-label={TYPE_META[type].label}
      style={style}
      className={cn('size-4 shrink-0 tint', className)}
    />
  );
}
