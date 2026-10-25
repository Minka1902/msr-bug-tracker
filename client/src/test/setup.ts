import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const listeners = new Set<() => void>();

export const setSystemDark = (dark: boolean) => {
  systemDark = dark;
  listeners.forEach((notify) => notify());
};

let systemDark = false;

vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    get matches() {
      return query.includes('dark') && systemDark;
    },
    media: query,
    addEventListener: (_: string, notify: () => void) => listeners.add(notify),
    removeEventListener: (_: string, notify: () => void) => listeners.delete(notify),
  })),
);
