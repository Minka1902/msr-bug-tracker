import { useRouteError } from 'react-router';
import { ErrorState } from '../components/ui/ErrorState';

export function RouteError() {
  const error = useRouteError();
  return <ErrorState error={error} onRetry={() => window.location.reload()} className="min-h-dvh" />;
}
