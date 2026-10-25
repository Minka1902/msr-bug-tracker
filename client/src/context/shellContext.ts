import { createContext } from 'react';

export interface ShellContextValue {
  openCreateProject: () => void;
  openQuickCreate: (defaults?: { projectKey?: string; statusId?: string; type?: string }) => void;
  openSearch: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);
