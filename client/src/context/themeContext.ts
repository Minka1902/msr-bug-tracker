import { createContext } from 'react';
import type { NavLayout, ThemeMode, ThemeStyle } from '@msr/shared/enums';

export interface ThemePrefs {
  style: ThemeStyle;
  mode: ThemeMode;
  nav: NavLayout;
}

export type ThemeListener = (prefs: ThemePrefs) => void;

export interface ThemeContextValue extends ThemePrefs {
  resolvedMode: 'light' | 'dark';
  setTheme: (patch: Partial<ThemePrefs>, options?: { silent?: boolean }) => void;
  subscribe: (listener: ThemeListener) => () => void;
}

export const DEFAULT_THEME: ThemePrefs = { style: 'aurora', mode: 'system', nav: 'sidebar' };

export const ThemeContext = createContext<ThemeContextValue | null>(null);
