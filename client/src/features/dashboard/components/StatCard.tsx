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
        <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
        {trend && (
          <Sparkline
            values={trend}
            color="var(--c)"
            height={30}
            className="ml-auto max-w-28 min-w-12 flex-1"
          />
        )}
      </div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}
