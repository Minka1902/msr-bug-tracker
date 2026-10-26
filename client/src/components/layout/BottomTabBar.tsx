import { FolderKanban, LayoutDashboard, ListTodo, Menu as MenuIcon, Search } from 'lucide-react';
import { NavLink } from 'react-router';
import type { ShellActions } from './shellTypes';

interface BottomTabBarProps {
  actions: ShellActions;
  menuOpen: boolean;
  onOpenMenu: () => void;
}

const TAB_CLASS =
  'flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium text-subtle transition-colors active:bg-surface-muted aria-[current=page]:text-accent-text aria-expanded:text-accent-text [&_svg]:size-6 max-[375px]:text-[10px]';

export function BottomTabBar({ actions, menuOpen, onOpenMenu }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Tab bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur-xl md:hidden"
    >
      <div className="flex h-16 items-stretch">
        <NavLink to="/" end className={TAB_CLASS}>
          <LayoutDashboard />
          Home
        </NavLink>
        <NavLink to="/my-tasks" className={TAB_CLASS}>
          <ListTodo />
          My Tasks
        </NavLink>
        <button type="button" onClick={actions.onSearch} className={TAB_CLASS}>
          <Search />
          Search
        </button>
        <NavLink to="/projects" className={TAB_CLASS}>
          <FolderKanban />
          Projects
        </NavLink>
        <button type="button" aria-expanded={menuOpen} onClick={onOpenMenu} className={TAB_CLASS}>
          <MenuIcon />
          Menu
        </button>
      </div>
    </nav>
  );
}
