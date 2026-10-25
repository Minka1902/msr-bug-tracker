import { useId } from 'react';
import { cn } from '../../lib/cn';

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  label?: string;
}

const WIDTH = 100;

export function Sparkline({ values, color = 'var(--c-accent)', height = 36, className, label }: SparklineProps) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  const points = values.map((value, index) => [index * step, height - 3 - (value / max) * (height - 6)] as const);
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  const gradientId = useId();

  if (values.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? `Trend: ${values.join(', ')}`}
      className={cn('w-full overflow-visible', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${WIDTH},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
