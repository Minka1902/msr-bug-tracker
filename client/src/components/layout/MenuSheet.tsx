import { CalendarDays, Palette, Search, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Sheet } from '../ui/Sheet';
import { AppearanceMenu } from './AppearanceMenu';
import { ProjectNavList } from './ProjectNavList';
import type { ShellActions, ShellProject, ShellUser } from './shellTypes';
import { UserCard } from './UserCard';

const TILE =
  'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-control bg-surface px-1 text-xs font-medium text-muted transition-colors active:bg-surface-muted aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text [&_svg]:size-5';

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ShellUser;
  projects: ShellProject[];
  actions: ShellActions;
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="px-1 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider text-subtle uppercase">
    {children}
  </p>
);

export function MenuSheet({ open, onOpenChange, user, projects, actions }: MenuSheetProps) {
  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Menu"
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={run(actions.onSearch)}
            className="flex h-12 cursor-pointer items-center gap-2.5 rounded-control border border-border bg-surface px-3 text-left text-subtle"
          >
            <Search className="size-4.5" />
            Search tasks, projects…
          </button>
          <div className="grid grid-cols-3 gap-2">
            <NavLink to="/calendar" onClick={() => onOpenChange(false)} className={TILE}>
              <CalendarDays />
              Calendar
            </NavLink>
            <NavLink to="/settings" onClick={() => onOpenChange(false)} className={TILE}>
              <Settings />
              Settings
            </NavLink>
            <AppearanceMenu
              trigger={
                <button type="button" className={TILE}>
                  <Palette />
                  Appearance
                </button>
              }
            />
          </div>
        </div>
      }
    >
      <SectionLabel>Projects</SectionLabel>
      <ProjectNavList
        projects={projects}
        onCreateProject={run(actions.onCreateProject)}
        onNavigate={() => onOpenChange(false)}
      />
      <SectionLabel>Account</SectionLabel>
      <UserCard user={user} onLogout={run(actions.onLogout)} onInvite={run(actions.onInvite)} />
    </Sheet>
  );
}
