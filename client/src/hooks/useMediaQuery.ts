import { useSyncExternalStore } from 'react';

export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (notify) => {
      const media = matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => false,
  );
