import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '@msr/shared/types';
import { AppShell } from '../components/layout/AppShell';
import { ShellContext, type ShellContextValue } from '../context/shellContext';
import { useLogout } from '../features/auth/api';
import { VerifyEmailBanner } from '../features/auth/components/VerifyEmailBanner';
import { useThemeSync } from '../features/auth/useThemeSync';
import { useProjects } from '../features/projects/api';
import { CreateProjectModal } from '../features/projects/components/CreateProjectModal';
import {
  QuickCreateTaskModal,
  type QuickCreateDefaults,
} from '../features/tasks/components/QuickCreateTaskModal';
import { TaskPeek } from '../features/tasks/components/TaskPeek';

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
  useThemeSync(user);

  const shell: ShellContextValue = {
    openCreateProject: () => setCreatingProject(true),
    openQuickCreate: (defaults = {}) =>
      setQuickCreate((current) => ({ open: true, defaults, version: current.version + 1 })),
    openSearch: () => undefined,
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
        banners={!user.emailVerified && !user.impersonator && <VerifyEmailBanner email={user.email} />}
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
    </ShellContext>
  );
}
