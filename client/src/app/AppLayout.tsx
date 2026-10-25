import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '@msr/shared/types';
import { AppShell } from '../components/layout/AppShell';
import { ShellContext, type ShellContextValue } from '../context/shellContext';
import { useLogout } from '../features/auth/api';
import { VerifyEmailBanner } from '../features/auth/components/VerifyEmailBanner';
import { useThemeSync } from '../features/auth/useThemeSync';
import { ImpersonationBanner } from '../features/demo/ImpersonationBanner';
import { InstallHint } from '../features/pwa/InstallHint';
import { OfflineBanner } from '../features/pwa/OfflineBanner';
import { useProjects } from '../features/projects/api';
import { CreateProjectModal } from '../features/projects/components/CreateProjectModal';
import {
  QuickCreateTaskModal,
  type QuickCreateDefaults,
} from '../features/tasks/components/QuickCreateTaskModal';
import { TaskPeek } from '../features/tasks/components/TaskPeek';
import { CommandPalette } from '../features/search/CommandPalette';
import { useHotkey } from '../hooks/useHotkey';

interface AppLayoutProps {
  user: CurrentUser;
  children: ReactNode;
}

export function AppLayout({ user, children }: AppLayoutProps) {
  const handleLogout = () =>
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });

  const navigate = useNavigate();
  const logout = useLogout();
  const projects = useProjects();
  const [creatingProject, setCreatingProject] = useState(false);
  const [quickCreate, setQuickCreate] = useState<{
    open: boolean;
    defaults: QuickCreateDefaults;
    version: number;
  }>({ open: false, defaults: {}, version: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  useThemeSync(user);
  useHotkey('k', () => setPaletteOpen((current) => !current));

  const shell: ShellContextValue = {
    openCreateProject: () => setCreatingProject(true),
    openQuickCreate: (defaults = {}) =>
      setQuickCreate((current) => ({ open: true, defaults, version: current.version + 1 })),
    openSearch: () => setPaletteOpen(true),
  };

  return (
    <ShellContext value={shell}>
      <AppShell
        user={user}
        projects={projects.data ?? []}
        actions={{
          onLogout: handleLogout,
          onSearch: shell.openSearch,
          onQuickCreate: () => shell.openQuickCreate(),
          onCreateProject: shell.openCreateProject,
        }}
        banners={
          <>
            <OfflineBanner />
            {user.impersonator ? (
              <ImpersonationBanner user={user} />
            ) : (
              !user.emailVerified && <VerifyEmailBanner email={user.email} />
            )}
            <InstallHint />
          </>
        }
      >
        {children}
      </AppShell>
      <CreateProjectModal open={creatingProject} onOpenChange={setCreatingProject} />
      <QuickCreateTaskModal
        key={quickCreate.version}
        open={quickCreate.open}
        defaults={quickCreate.defaults}
        onOpenChange={(open) => setQuickCreate((current) => ({ ...current, open }))}
      />
      <TaskPeek />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onCreateTask={() => shell.openQuickCreate()}
        onCreateProject={shell.openCreateProject}
        onLogout={handleLogout}
      />
    </ShellContext>
  );
}
