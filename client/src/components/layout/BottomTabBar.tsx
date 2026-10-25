import { FolderKanban, LayoutDashboard, ListTodo, Plus, Search } from 'lucide-react';
import { NavLink } from 'react-router';
import type { ShellActions } from './shellTypes';

interface BottomTabBarProps {
  actions: ShellActions;
}

const TAB_CLASS =
  'flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-subtle transition-colors aria-[current=page]:text-accent-text [&_svg]:size-5.5';

export function BottomTabBar({ actions }: BottomTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur-xl md:hidden">
      <div className="flex h-16 items-stretch px-2">
        <NavLink to="/" end className={TAB_CLASS}>
          <LayoutDashboard />
          Home
        </NavLink>
        <NavLink to="/my-tasks" className={TAB_CLASS}>
          <ListTodo />
          My Tasks
        </NavLink>
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="New task"
            onClick={actions.onQuickCreate}
            className="flex size-13 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_10px_24px_-8px_var(--c-accent)] active:scale-95 [&_svg]:size-6"
          >
            <Plus />
          </button>
        </div>
        <NavLink to="/projects" className={TAB_CLASS}>
          <FolderKanban />
          Projects
        </NavLink>
        <button type="button" onClick={actions.onSearch} className={TAB_CLASS}>
          <Search />
          Search
        </button>
      </div>
    </nav>
  );
}
