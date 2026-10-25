import type { CSSProperties, ReactNode } from 'react';
import type { Tone } from '@msr/shared/enums';
import { cn } from '../../lib/cn';

interface BannerProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Banner({ tone = 'info', icon, children, action, className }: BannerProps) {
  return (
    <div
      role="status"
      style={{ '--c': `var(--tone-${tone})` } as CSSProperties}
      className={cn(
        'chip flex items-center gap-3 rounded-control px-3 py-2 text-sm [&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
