import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/cn';
import { COARSE } from '../../lib/media';

const HOLD_MS = 200;
const COMMIT_DISTANCE = 88;
const COMMIT_VELOCITY = 0.5;
const MAX_TRAVEL = 160;
const RESISTANCE = 0.25;

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string;
  onAction: () => void;
}

interface SwipeRowProps {
  primary?: SwipeAction;
  secondary?: SwipeAction;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function SwipeRow({ primary, secondary, disabled, children, className }: SwipeRowProps) {
  const actionFor = (direction: number) =>
    direction === 0 ? undefined : direction === inward ? primary : secondary;

  const { hand } = useTheme();
  const touch = useMediaQuery(COARSE);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inward = hand === 'right' ? -1 : 1;
  const drag = usePointerDrag({
    axis: 'x',
    maxHold: HOLD_MS,
    disabled: disabled || !touch || (!primary && !secondary),
    onMove: (next) => {
      setDragging(true);
      setOffset(
        actionFor(Math.sign(next)) ? Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, next)) : next * RESISTANCE,
      );
    },
    onEnd: (distance, velocity) => {
      const direction = Math.sign(distance);
      const action = actionFor(direction);
      setDragging(false);
      setOffset(0);
      if (action && (Math.abs(distance) >= COMMIT_DISTANCE || velocity * direction >= COMMIT_VELOCITY))
        action.onAction();
    },
  });
  const active = actionFor(Math.sign(offset));
  const ready = Math.abs(offset) >= COMMIT_DISTANCE;

  return (
    <div {...drag} className={cn('relative touch-pan-y overflow-hidden rounded-control', className)}>
      {active && (
        <div
          aria-hidden
          style={{ '--c': active.color } as CSSProperties}
          className={cn(
            'absolute inset-0 flex items-center gap-2 bg-(--c) px-5 text-sm font-semibold text-white transition-opacity [&_svg]:size-5',
            offset < 0 ? 'justify-end' : 'justify-start',
            !ready && 'opacity-70',
          )}
        >
          {active.icon}
          {active.label}
        </div>
      )}
      <div
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        className={cn('relative bg-surface', !dragging && 'transition-transform duration-200')}
      >
        {children}
      </div>
    </div>
  );
}
