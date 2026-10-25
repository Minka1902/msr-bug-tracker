import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  showValue?: boolean;
  className?: string;
}

const HEIGHTS = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' };

export function ProgressBar({ value, color, size = 'sm', label, showValue, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const style = { '--c': color ?? 'var(--c-accent)', width: `${clamped}%` } as CSSProperties;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{label}</span>
          {showValue && <span className="font-semibold text-text tabular-nums">{clamped}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('w-full overflow-hidden rounded-full bg-surface-muted', HEIGHTS[size])}
      >
        <div
          style={style}
          className="h-full rounded-full bg-[linear-gradient(90deg,color-mix(in_oklab,var(--c)_70%,white),var(--c))] transition-[width] duration-500"
        />
      </div>
    </div>
  );
}
