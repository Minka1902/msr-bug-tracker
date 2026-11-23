import { useEffect, useRef, useState } from 'react';

const OPEN_LAYER = '[data-radix-popper-content-wrapper], [role="dialog"]';

export const useTaskSelection = () => {
  const toggle = (id: string, order?: string[]) => {
    const anchor = anchorRef.current;
    const from = anchor && order ? order.indexOf(anchor) : -1;
    const to = order ? order.indexOf(id) : -1;
    const span = from >= 0 && to >= 0 ? order!.slice(Math.min(from, to), Math.max(from, to) + 1) : null;
    setIds((current) => {
      const next = new Set(current);
      if (span) span.forEach((item) => next.add(item));
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchorRef.current = id;
    setSelecting(true);
  };

  const clear = () => {
    setIds(new Set());
    setSelecting(false);
    anchorRef.current = null;
  };

  const [ids, setIds] = useState(new Set<string>());
  const [selecting, setSelecting] = useState(false);
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector(OPEN_LAYER)) return;
      setIds(new Set());
      setSelecting(false);
      anchorRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selecting]);

  return { ids, selecting, toggle, set: setIds, start: () => setSelecting(true), clear };
};

export type TaskSelection = ReturnType<typeof useTaskSelection>;
