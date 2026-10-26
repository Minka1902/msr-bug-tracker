import { createContext } from 'react';
import type { ProjectDetail } from '@msr/shared/types';

export type InviteTarget = Pick<ProjectDetail, 'key' | 'name' | 'roles' | 'permissions'> & { email?: string };

export interface ShellContextValue {
  openCreateProject: () => void;
  openQuickCreate: (defaults?: { projectKey?: string; statusId?: string; type?: string }) => void;
  openSearch: () => void;
  openInvite: (target?: InviteTarget) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);
