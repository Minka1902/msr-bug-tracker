import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
import { Sparkline } from '../../../components/ui/Sparkline';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  trend?: number[];
  className?: string;
}

export function StatCard({ label, value, hint, icon, tone = 'accent', trend, className }: StatCardProps) {
  const style = { '--c': `var(--tone-${tone})` } as CSSProperties;

  return (
    <Card style={style} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {icon && (
          <span className="chip flex size-6 items-center justify-center rounded-md [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
          {hint && <span className="truncate text-xs text-muted">{hint}</span>}
        </div>
        {trend && (
          <Sparkline values={trend} color="var(--c)" height={34} className="ml-auto max-w-24 max-sm:hidden" />
        )}
      </div>
    </Card>
  );
}
