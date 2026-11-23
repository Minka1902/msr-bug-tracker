import type { ReactNode } from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { cn } from '../../../lib/cn';

interface PlanItemRowProps {
  title: string;
  summary?: string;
  meta?: ReactNode;
  kept: boolean;
  onToggle: () => void;
}

export function PlanItemRow({ title, summary, meta, kept, onToggle }: PlanItemRowProps) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-control border border-border bg-surface p-3',
        !kept && 'opacity-60',
      )}
    >
      <Checkbox checked={kept} onCheckedChange={onToggle} aria-label={`Keep ${title}`} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {summary && <p className="text-xs text-muted">{summary}</p>}
        {meta && <p className="flex flex-wrap items-center gap-3 text-xs text-subtle">{meta}</p>}
      </div>
    </li>
  );
}
