import type { Emblem } from '@msr/shared/emblem';
import type { ProjectKind } from '@msr/shared/enums';

export interface ShellProject {
  key: string;
  kind: ProjectKind;
  name: string;
  color: string;
  icon: string;
  emblem: Emblem | null;
  isFavorite: boolean;
}

export interface ShellUser {
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ShellActions {
  onLogout: () => void;
  onSearch: () => void;
  onQuickCreate: (defaults?: { projectKey?: string; type?: string }) => void;
  onCreateProject: () => void;
  onInvite: () => void;
}
