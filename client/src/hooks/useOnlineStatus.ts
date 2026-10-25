import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
  addEventListener('online', listener);
  addEventListener('offline', listener);
  return () => {
    removeEventListener('online', listener);
    removeEventListener('offline', listener);
  };
};

export const useOnlineStatus = () => useSyncExternalStore(subscribe, () => navigator.onLine);
