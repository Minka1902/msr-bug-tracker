export interface ShellProject {
  key: string;
  name: string;
  color: string;
  icon: string;
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
  onQuickCreate: () => void;
  onCreateProject: () => void;
  onInvite: () => void;
}
