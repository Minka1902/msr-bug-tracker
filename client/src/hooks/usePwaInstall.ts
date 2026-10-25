import { useSyncExternalStore } from 'react';
import { promptInstall, pwaInstallStore } from '../lib/pwaInstall';

export const usePwaInstall = () => ({
  ...useSyncExternalStore(pwaInstallStore.subscribe, pwaInstallStore.getSnapshot),
  promptInstall,
});
