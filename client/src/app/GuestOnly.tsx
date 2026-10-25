import { Navigate, Outlet, useSearchParams } from 'react-router';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { useMe } from '../features/auth/api';
import { safeNextPath } from '../lib/safeNextPath';

export function GuestOnly() {
  const [params] = useSearchParams();
  const { data: user, isPending } = useMe();

  if (isPending) return <FullScreenLoader />;
  if (user) return <Navigate to={safeNextPath(params.get('next'))} replace />;

  return <Outlet />;
}
