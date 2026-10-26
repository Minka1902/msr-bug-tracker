import { useDroppable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import type { ProjectStatus } from '@msr/shared/types';
import { cn } from '../../../lib/cn';

export const PILL_PREFIX = 'pill:';

interface BoardColumnPillProps {
  status: ProjectStatus;
  count: number;
  selected: boolean;
  onSelect: () => void;
}

export function BoardColumnPill({ status, count, selected, onSelect }: BoardColumnPillProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${PILL_PREFIX}${status.id}` });

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      style={{ '--c': status.color } as CSSProperties}
      className={cn(
        'flex h-(--tap) shrink-0 cursor-pointer snap-start items-center gap-2 rounded-full border border-transparent px-3.5 text-sm font-medium text-muted transition-[transform,background-color]',
        'aria-selected:border-(--c) aria-selected:chip aria-selected:font-semibold',
        isOver && 'scale-110 border-(--c) chip',
      )}
    >
      <span className="size-2.5 shrink-0 rounded-full bg-(--c)" />
      <span className="max-w-32 truncate">{status.name}</span>
      <span className="text-xs text-subtle tabular-nums">{count}</span>
    </button>
  );
}
