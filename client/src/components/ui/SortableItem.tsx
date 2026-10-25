import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type DragHandleProps = Record<string, unknown>;

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  children: (handle: DragHandleProps, dragging: boolean) => ReactNode;
  className?: string;
}

export function SortableItem({ id, disabled, children, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-80', className)}
    >
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}
