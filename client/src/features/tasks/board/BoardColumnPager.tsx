import type { ProjectStatus } from '@msr/shared/types';
import { BoardColumnPill } from './BoardColumnPill';

interface BoardColumnPagerProps {
  statuses: ProjectStatus[];
  counts: Record<string, number>;
  value: string;
  onChange: (statusId: string) => void;
}

export function BoardColumnPager({ statuses, counts, value, onChange }: BoardColumnPagerProps) {
  return (
    <div
      role="tablist"
      aria-label="Board columns"
      className="fixed right-20 bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-20 flex snap-x gap-1.5 overflow-x-auto rounded-full border border-border bg-surface/95 p-1.5 shadow-pop backdrop-blur-xl no-scrollbar lefty:right-3 lefty:left-20"
    >
      {statuses.map((status) => (
        <BoardColumnPill
          key={status.id}
          status={status}
          count={counts[status.id] ?? 0}
          selected={status.id === value}
          onSelect={() => onChange(status.id)}
        />
      ))}
    </div>
  );
}
