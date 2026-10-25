import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-14',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl bg-accent-soft text-accent-text',
            compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-7',
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn('font-display font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
