import { Suspense, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '@msr/shared/types';
import { AppShell } from '../components/layout/AppShell';
import { ShellContext, type InviteTarget, type ShellContextValue } from '../context/shellContext';
import { useLogout } from '../features/auth/api';
import { VerifyEmailBanner } from '../features/auth/components/VerifyEmailBanner';
import { useThemeSync } from '../features/auth/useThemeSync';
import { ImpersonationBanner } from '../features/demo/ImpersonationBanner';
import { InstallHint } from '../features/pwa/InstallHint';
import { OfflineBanner } from '../features/pwa/OfflineBanner';
import { useProjects } from '../features/projects/api';
import { CreateProjectModal } from '../features/projects/components/CreateProjectModal';
import type { QuickCreateDefaults } from '../features/tasks/components/QuickCreateTaskModal';
import { useHotkey } from '../hooks/useHotkey';
import { lazyComponent } from '../lib/lazy';

const InviteDialog = lazyComponent(() =>
  import('../features/invites/components/InviteDialog').then((m) => m.InviteDialog),
);
const QuickCreateTaskModal = lazyComponent(() =>
  import('../features/tasks/components/QuickCreateTaskModal').then((m) => m.QuickCreateTaskModal),
);
const TaskPeek = lazyComponent(() => import('../features/tasks/components/TaskPeek').then((m) => m.TaskPeek));
const CommandPalette = lazyComponent(() =>
  import('../features/search/CommandPalette').then((m) => m.CommandPalette),
);

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
  const [invite, setInvite] = useState<{ open: boolean; target?: InviteTarget; version: number }>({
    open: false,
    version: 0,
  });
  useThemeSync(user);
  useHotkey('k', () => setPaletteOpen((current) => !current));

  const shell: ShellContextValue = {
    openCreateProject: () => setCreatingProject(true),
    openQuickCreate: (defaults = {}) =>
      setQuickCreate((current) => ({ open: true, defaults, version: current.version + 1 })),
    openSearch: () => setPaletteOpen(true),
    openInvite: (target) => setInvite((current) => ({ open: true, target, version: current.version + 1 })),
  };

  return (
    <ShellContext value={shell}>
      <AppShell
        user={user}
        projects={projects.data ?? []}
        actions={{
          onLogout: handleLogout,
          onSearch: shell.openSearch,
          onQuickCreate: (defaults) => shell.openQuickCreate(defaults),
          onCreateProject: shell.openCreateProject,
          onInvite: () => shell.openInvite(),
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
      <Suspense fallback={null}>
        <QuickCreateTaskModal
          key={`quick-create-${quickCreate.version}`}
          open={quickCreate.open}
          defaults={quickCreate.defaults}
          onOpenChange={(open) => setQuickCreate((current) => ({ ...current, open }))}
        />
        <InviteDialog
          key={`invite-${invite.version}`}
          open={invite.open}
          project={invite.target}
          defaultEmail={invite.target?.email}
          onOpenChange={(open) => setInvite((current) => ({ ...current, open }))}
        />
        <TaskPeek />
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onCreateTask={() => shell.openQuickCreate()}
          onCreateProject={shell.openCreateProject}
          onLogout={handleLogout}
        />
      </Suspense>
    </ShellContext>
  );
}
