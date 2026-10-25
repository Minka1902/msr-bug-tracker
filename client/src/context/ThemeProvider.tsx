import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { readLocal, writeLocal } from '../lib/localStore';
import { DEFAULT_THEME, ThemeContext, type ThemePrefs } from './themeContext';

const STORAGE_KEY = 'msr-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeProviderProps {
  children: ReactNode;
  initial?: Partial<ThemePrefs>;
  onChange?: (prefs: ThemePrefs) => void;
}

const subscribeToScheme = (notify: () => void) => {
  const media = matchMedia(DARK_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

const systemPrefersDark = () => matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children, initial, onChange }: ThemeProviderProps) {
  const setTheme = (patch: Partial<ThemePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeLocal(STORAGE_KEY, next);
    onChange?.(next);
  };

  const [prefs, setPrefs] = useState<ThemePrefs>(() => ({ ...readLocal(STORAGE_KEY, DEFAULT_THEME), ...initial }));
  const systemDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark);
  const resolvedMode = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.style = prefs.style;
    root.dataset.mode = resolvedMode;
    root.dataset.nav = prefs.nav;
    const themeColor = getComputedStyle(root).getPropertyValue('--theme-color').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [prefs.style, prefs.nav, resolvedMode]);

  return <ThemeContext value={{ ...prefs, resolvedMode, setTheme }}>{children}</ThemeContext>;
}
