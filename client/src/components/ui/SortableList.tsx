import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { SortableItem, type DragHandleProps } from './SortableItem';

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onMove: (item: T, previous: T | null, next: T | null) => void;
  renderItem: (item: T, handle: DragHandleProps, dragging: boolean) => ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SortableList<T>({
  items,
  getId,
  onMove,
  renderItem,
  disabled,
  className,
}: SortableListProps<T>) {
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => getId(item) === active.id);
    const to = items.findIndex((item) => getId(item) === over.id);
    const reordered = arrayMove(items, from, to);
    onMove(reordered[to]!, reordered[to - 1] ?? null, reordered[to + 1] ?? null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)} disabled={disabled}>
              {(handle, dragging) => renderItem(item, handle, dragging)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
