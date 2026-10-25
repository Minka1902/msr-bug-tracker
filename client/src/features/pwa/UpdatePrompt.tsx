import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const watchForUpdates = (_url: string, registration?: ServiceWorkerRegistration) => {
    if (!registration) return;
    setInterval(() => registration.update(), UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  };

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: watchForUpdates });

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version is available', {
      id: 'pwa-update',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
