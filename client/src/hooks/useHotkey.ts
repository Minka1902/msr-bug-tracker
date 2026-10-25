import { useEffect, useRef } from 'react';

export const useHotkey = (key: string, handler: (event: KeyboardEvent) => void, { mod = true } = {}) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key || (mod && !(event.metaKey || event.ctrlKey))) return;
      event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [key, mod]);
};
