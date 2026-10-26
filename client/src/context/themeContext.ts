import { createContext } from 'react';
import type { Hand, NavLayout, ThemeMode, ThemeStyle, TouchSize } from '@msr/shared/enums';

export interface ThemePrefs {
  style: ThemeStyle;
  mode: ThemeMode;
  nav: NavLayout;
  hand: Hand;
  touch: TouchSize;
}

export type ThemeListener = (prefs: ThemePrefs) => void;

export interface ThemeContextValue extends ThemePrefs {
  resolvedMode: 'light' | 'dark';
  setTheme: (patch: Partial<ThemePrefs>, options?: { silent?: boolean }) => void;
  subscribe: (listener: ThemeListener) => () => void;
}

export const DEFAULT_THEME: ThemePrefs = {
  style: 'aurora',
  mode: 'system',
  nav: 'sidebar',
  hand: 'right',
  touch: 'standard',
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
