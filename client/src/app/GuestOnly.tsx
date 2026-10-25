import { Navigate, Outlet } from 'react-router';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { useMe } from '../features/auth/api';

export function GuestOnly() {
  const { data: user, isPending } = useMe();

  if (isPending) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
