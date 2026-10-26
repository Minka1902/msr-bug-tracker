import { useRef, type MouseEvent, type PointerEvent } from 'react';

const SLOP = 8;

interface PointerDragOptions {
  axis: 'x' | 'y';
  onMove: (offset: number) => void;
  onEnd: (offset: number, velocity: number) => void;
  disabled?: boolean;
  maxHold?: number;
}

interface DragState {
  id: number;
  start: number;
  cross: number;
  last: number;
  time: number;
  downAt: number;
  velocity: number;
  locked: boolean | null;
}

export const usePointerDrag = ({ axis, onMove, onEnd, disabled, maxHold = Infinity }: PointerDragOptions) => {
  const along = (event: PointerEvent) => (axis === 'x' ? event.clientX : event.clientY);
  const across = (event: PointerEvent) => (axis === 'x' ? event.clientY : event.clientX);

  const finish = (event: PointerEvent, completed: boolean) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    if (!state.locked) return;
    suppressClick.current = completed;
    onEnd(completed ? along(event) - state.start : 0, completed ? state.velocity : 0);
  };

  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      suppressClick.current = false;
      if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag.current = {
        id: event.pointerId,
        start: along(event),
        cross: across(event),
        last: along(event),
        time: event.timeStamp,
        downAt: event.timeStamp,
        velocity: 0,
        locked: null,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const state = drag.current;
      if (!state || state.id !== event.pointerId || state.locked === false) return;
      const offset = along(event) - state.start;
      if (state.locked === null) {
        const sideways = Math.abs(across(event) - state.cross);
        if (Math.max(Math.abs(offset), sideways) < SLOP) return;
        state.locked = Math.abs(offset) > sideways && event.timeStamp - state.downAt <= maxHold;
        if (!state.locked) return;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const elapsed = event.timeStamp - state.time;
      if (elapsed > 0) state.velocity = (along(event) - state.last) / elapsed;
      state.last = along(event);
      state.time = event.timeStamp;
      onMove(offset);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, false),
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
};
