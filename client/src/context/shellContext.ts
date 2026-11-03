import { createContext } from 'react';
import type { ProjectModule } from '@msr/shared/modules';
import type { ProjectDetail } from '@msr/shared/types';
import type { TaskCreateValues } from '../features/tasks/components/TaskCreateFields';

export type InviteTarget = Pick<ProjectDetail, 'key' | 'name' | 'roles' | 'permissions'> & { email?: string };

export type QuickCreateDefaults = { projectKey?: string } & Partial<TaskCreateValues>;

export interface ShellContextValue {
  openCreateProject: (module?: ProjectModule) => void;
  openQuickCreate: (defaults?: QuickCreateDefaults) => void;
  openSearch: () => void;
  openInvite: (target?: InviteTarget) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);
