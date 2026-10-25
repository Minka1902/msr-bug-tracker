import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const LANE_TOLERANCE = 4;
const DIRECTIONS: Partial<Record<string, 1 | -1>> = { [KeyboardCode.Right]: 1, [KeyboardCode.Left]: -1 };

export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const direction = DIRECTIONS[event.code];
  if (!direction) return sortableKeyboardCoordinates(event, args);
  const { collisionRect, droppableRects, droppableContainers } = args.context;
  if (!collisionRect) return undefined;

  const centerX = collisionRect.left + collisionRect.width / 2;
  const centerY = collisionRect.top + collisionRect.height / 2;
  const columns = droppableContainers
    .getEnabled()
    .filter((container) => !container.data.current?.sortable)
    .flatMap((container) => {
      const rect = droppableRects.get(container.id);
      return rect ? [rect] : [];
    });
  const current = columns
    .filter((rect) => rect.left <= centerX && centerX <= rect.right && rect.top <= centerY + LANE_TOLERANCE)
    .sort((a, b) => b.top - a.top)[0];
  if (!current) return undefined;

  const target = columns
    .filter((rect) => Math.abs(rect.top - current.top) <= LANE_TOLERANCE)
    .filter((rect) => (direction > 0 ? rect.left > current.left : rect.left < current.left))
    .sort((a, b) => (a.left - b.left) * direction)[0];
  if (!target) return undefined;

  event.preventDefault();
  return { x: target.left + (target.width - collisionRect.width) / 2, y: target.top };
};
