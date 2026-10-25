import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '@msr/shared/types';
import { AppShell } from '../components/layout/AppShell';
import { useLogout } from '../features/auth/api';
import { VerifyEmailBanner } from '../features/auth/components/VerifyEmailBanner';
import { useThemeSync } from '../features/auth/useThemeSync';

interface AppLayoutProps {
  user: CurrentUser;
  children: ReactNode;
}

export function AppLayout({ user, children }: AppLayoutProps) {
  const handleLogout = () =>
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });

  const navigate = useNavigate();
  const logout = useLogout();
  useThemeSync(user);

  return (
    <AppShell
      user={user}
      projects={[]}
      actions={{
        onLogout: handleLogout,
        onSearch: () => undefined,
        onQuickCreate: () => undefined,
        onCreateProject: () => navigate('/projects?new=1'),
      }}
      banners={!user.emailVerified && !user.impersonator && <VerifyEmailBanner email={user.email} />}
    >
      {children}
    </AppShell>
  );
}
