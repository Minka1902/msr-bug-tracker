import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const WORKSPACE_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/my-tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: true },
];

export const SYSTEM_NAV: NavItem[] = [{ to: '/settings', label: 'Settings', icon: Settings }];
