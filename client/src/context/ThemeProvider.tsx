import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { readLocal, writeLocal } from '../lib/localStore';
import { DEFAULT_THEME, ThemeContext, type ThemeListener, type ThemePrefs } from './themeContext';

const STORAGE_KEY = 'msr-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeProviderProps {
  children: ReactNode;
  initial?: Partial<ThemePrefs>;
}

const subscribeToScheme = (notify: () => void) => {
  const media = matchMedia(DARK_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

const systemPrefersDark = () => matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children, initial }: ThemeProviderProps) {
  const setTheme = (patch: Partial<ThemePrefs>, { silent = false } = {}) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeLocal(STORAGE_KEY, next);
    if (!silent) listeners.current.forEach((listener) => listener(next));
  };

  const subscribe = (listener: ThemeListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  };

  const [prefs, setPrefs] = useState<ThemePrefs>(() => ({
    ...DEFAULT_THEME,
    ...readLocal(STORAGE_KEY, DEFAULT_THEME),
    ...initial,
  }));
  const listeners = useRef(new Set<ThemeListener>());
  const systemDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark);
  const resolvedMode = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.style = prefs.style;
    root.dataset.mode = resolvedMode;
    root.dataset.nav = prefs.nav;
    root.dataset.hand = prefs.hand;
    root.dataset.touch = prefs.touch;
    const themeColor = getComputedStyle(root).getPropertyValue('--theme-color').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [prefs.style, prefs.nav, prefs.hand, prefs.touch, resolvedMode]);

  return <ThemeContext value={{ ...prefs, resolvedMode, setTheme, subscribe }}>{children}</ThemeContext>;
}
