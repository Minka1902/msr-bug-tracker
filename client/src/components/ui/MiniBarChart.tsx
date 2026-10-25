import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  className?: string;
  showLabels?: boolean;
}

export function MiniBarChart({ data, height = 64, className, showLabels = true }: MiniBarChartProps) {
  const max = Math.max(1, ...data.map((datum) => datum.value));

  return (
    <div role="img" aria-label={data.map((datum) => `${datum.label}: ${datum.value}`).join(', ')} className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((datum) => (
          <div
            key={datum.label}
            title={`${datum.label}: ${datum.value}`}
            style={{ '--c': datum.color ?? 'var(--c-accent)', height: `${Math.max(6, (datum.value / max) * 100)}%` } as CSSProperties}
            className="flex-1 rounded-t-[5px] rounded-b-[2px] bg-(--c) opacity-90 transition-[height] duration-500"
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-1.5">
          {data.map((datum) => (
            <span key={datum.label} className="flex-1 truncate text-center text-[10px] opacity-70">
              {datum.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
