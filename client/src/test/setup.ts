import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const listeners = new Set<() => void>();

export const setSystemDark = (dark: boolean) => {
  systemDark = dark;
  listeners.forEach((notify) => notify());
};

export const setCoarsePointer = (coarse: boolean) => {
  coarsePointer = coarse;
  listeners.forEach((notify) => notify());
};

let systemDark = false;
let coarsePointer = false;

vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    get matches() {
      return (query.includes('dark') && systemDark) || (query.includes('pointer: coarse') && coarsePointer);
    },
    media: query,
    addEventListener: (_: string, notify: () => void) => listeners.add(notify),
    removeEventListener: (_: string, notify: () => void) => listeners.delete(notify),
  })),
);

afterEach(cleanup);
