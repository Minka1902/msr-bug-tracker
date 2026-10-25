import { PanelLeftClose } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Logo } from './Logo';
import { NavLinkItem } from './NavLinkItem';
import { SYSTEM_NAV, WORKSPACE_NAV } from './navItems';
import { ProjectNavList } from './ProjectNavList';
import type { ShellActions, ShellProject, ShellUser } from './shellTypes';
import { UserCard } from './UserCard';

interface SidebarProps {
  user: ShellUser;
  projects: ShellProject[];
  actions: ShellActions;
  onCollapse?: () => void;
  onNavigate?: () => void;
}

const SectionLabel = ({ children }: { children: string }) => (
  <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider text-subtle uppercase">
    {children}
  </p>
);

export function Sidebar({ user, projects, actions, onCollapse, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-3 p-3 clean:border-r clean:border-border clean:bg-surface">
      <div className="flex h-12 items-center justify-between px-2">
        <Logo />
        {onCollapse && (
          <IconButton
            icon={<PanelLeftClose />}
            label="Collapse sidebar"
            onClick={onCollapse}
            tooltipSide="right"
          />
        )}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-card px-2 pb-3 scrollbar-thin aurora:glass aurora:border aurora:border-white/50 aurora:shadow-card aurora:dark:border-white/5">
        <SectionLabel>Workspace</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {WORKSPACE_NAV.map((item) => (
            <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <SectionLabel>Projects</SectionLabel>
        <ProjectNavList
          projects={projects}
          onCreateProject={actions.onCreateProject}
          onNavigate={onNavigate}
        />
        <SectionLabel>System</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {SYSTEM_NAV.map((item) => (
            <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
      <UserCard user={user} onLogout={actions.onLogout} />
    </aside>
  );
}
