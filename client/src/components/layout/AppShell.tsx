import { useState, type ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { readLocal, writeLocal } from '../../lib/localStore';
import { Drawer } from '../ui/Drawer';
import { BottomTabBar } from './BottomTabBar';
import { IconRail } from './IconRail';
import { ProjectPanel } from './ProjectPanel';
import type { ShellActions, ShellProject, ShellUser } from './shellTypes';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const STORAGE_KEY = 'msr-shell';

interface AppShellProps {
  user: ShellUser;
  projects: ShellProject[];
  actions: ShellActions;
  banners?: ReactNode;
  children: ReactNode;
}

export function AppShell({ user, projects, actions, banners, children }: AppShellProps) {
  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    writeLocal(STORAGE_KEY, { collapsed: next });
  };

  const { nav } = useTheme();
  const [collapsed, setCollapsedState] = useState(
    () => readLocal(STORAGE_KEY, { collapsed: false }).collapsed,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="md:h-dvh md:p-(--shell-margin)">
      <div className="flex min-h-dvh md:h-full md:min-h-0 md:overflow-hidden md:rounded-(--shell-radius) md:bg-app md:shadow-[0_30px_80px_-30px_rgb(15_23_42/0.5)] clean:md:shadow-none">
        <div className="hidden md:flex">
          {nav === 'sidebar' && !collapsed && (
            <Sidebar
              user={user}
              projects={projects}
              actions={actions}
              onCollapse={() => setCollapsed(true)}
            />
          )}
          {(nav === 'rail' || collapsed) && (
            <IconRail
              user={user}
              actions={actions}
              panelOpen={nav === 'rail' && !collapsed}
              onTogglePanel={() => setCollapsed(false)}
            />
          )}
          {nav === 'rail' && !collapsed && (
            <ProjectPanel
              projects={projects}
              onCreateProject={actions.onCreateProject}
              onCollapse={() => setCollapsed(true)}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-app md:overflow-hidden">
          <Topbar actions={actions} onOpenMenu={() => setMenuOpen(true)} />
          <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:overflow-y-auto md:px-6 md:pb-6 scrollbar-thin">
            {banners && <div className="mb-4 flex flex-col gap-2 empty:hidden">{banners}</div>}
            {children}
          </main>
        </div>
      </div>
      <BottomTabBar actions={actions} />
      <Drawer open={menuOpen} onOpenChange={setMenuOpen} side="left" title="Navigation" className="bg-app">
        <Sidebar user={user} projects={projects} actions={actions} onNavigate={() => setMenuOpen(false)} />
      </Drawer>
    </div>
  );
}
