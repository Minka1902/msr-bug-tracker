import { useEffect, useState } from 'react';

const REVEAL_ZONE = 64;
const MIN_DELTA = 8;

export const useScrollHidden = (enabled: boolean) => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < REVEAL_ZONE) setHidden(false);
      else if (Math.abs(y - last) >= MIN_DELTA) setHidden(y > last);
      else return;
      last = y;
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return enabled && hidden;
};
