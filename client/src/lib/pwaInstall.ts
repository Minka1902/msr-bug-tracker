interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstallState {
  ios: boolean;
  standalone: boolean;
  canPrompt: boolean;
}

const STANDALONE_QUERY = '(display-mode: standalone)';
const listeners = new Set<() => void>();
const standaloneMedia = matchMedia(STANDALONE_QUERY);
let deferred: InstallPromptEvent | null = null;

const read = (): PwaInstallState => ({
  ios:
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  standalone: standaloneMedia.matches || (navigator as { standalone?: boolean }).standalone === true,
  canPrompt: deferred !== null,
});

let state = read();

const refresh = () => {
  state = read();
  listeners.forEach((listener) => listener());
};

addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferred = event as InstallPromptEvent;
  refresh();
});
addEventListener('appinstalled', () => {
  deferred = null;
  refresh();
});
standaloneMedia.addEventListener('change', refresh);

export const pwaInstallStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
};

export const promptInstall = async () => {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  refresh();
  return outcome === 'accepted';
};
