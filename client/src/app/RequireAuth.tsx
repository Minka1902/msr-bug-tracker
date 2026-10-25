import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState } from '../components/ui/ErrorState';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { useMe } from '../features/auth/api';
import { AppLayout } from './AppLayout';

export function RequireAuth() {
  const location = useLocation();
  const { data: user, isPending, error, refetch } = useMe();

  if (isPending) return <FullScreenLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-dvh" />;
  if (!user)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  );
}
