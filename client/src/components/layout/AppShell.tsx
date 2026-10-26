import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTheme } from '../../hooks/useTheme';
import { readLocal, writeLocal } from '../../lib/localStore';
import { PHONE, TABLET_PORTRAIT } from '../../lib/media';
import { BottomTabBar } from './BottomTabBar';
import { FloatingCreateButton } from './FloatingCreateButton';
import { IconRail } from './IconRail';
import { MenuSheet } from './MenuSheet';
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
  const phone = useMediaQuery(PHONE);
  const tablet = useMediaQuery(TABLET_PORTRAIT);
  const [collapsed, setCollapsedState] = useState(
    () => readLocal(STORAGE_KEY, { collapsed: false }).collapsed,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const showSidebar = !tablet && nav === 'sidebar' && !collapsed;
  const showPanel = !tablet && nav === 'rail' && !collapsed;

  return (
    <div className="md:h-dvh md:p-(--shell-margin) max-lg:md:p-0">
      <div className="flex min-h-dvh md:h-full md:min-h-0 md:overflow-hidden md:rounded-(--shell-radius) md:bg-app md:shadow-[0_30px_80px_-30px_rgb(15_23_42/0.5)] max-lg:md:rounded-none clean:md:shadow-none">
        <div className="hidden md:flex">
          {showSidebar && (
            <Sidebar
              user={user}
              projects={projects}
              actions={actions}
              onCollapse={() => setCollapsed(true)}
            />
          )}
          {!showSidebar && (
            <IconRail
              user={user}
              actions={actions}
              panelOpen={showPanel}
              onTogglePanel={tablet ? undefined : () => setCollapsed(false)}
            />
          )}
          {showPanel && (
            <ProjectPanel
              projects={projects}
              onCreateProject={actions.onCreateProject}
              onCollapse={() => setCollapsed(true)}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-app md:overflow-hidden">
          <Topbar actions={actions} phone={phone} />
          <main className="flex-1 px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] max-[375px]:px-3 md:overflow-y-auto md:px-6 md:pb-6 scrollbar-thin">
            {banners && <div className="mb-4 flex flex-col gap-2 empty:hidden">{banners}</div>}
            {children}
          </main>
        </div>
      </div>
      {phone && (
        <>
          <FloatingCreateButton projects={projects} onCreate={actions.onQuickCreate} />
          <BottomTabBar actions={actions} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
          <MenuSheet
            open={menuOpen}
            onOpenChange={setMenuOpen}
            user={user}
            projects={projects}
            actions={actions}
          />
        </>
      )}
    </div>
  );
}
