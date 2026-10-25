import { Navigate, useParams } from 'react-router';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader';
import { ApiError } from '../../../lib/api';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { useTaskByIdentifier } from '../api';

export function IdentifierRedirect() {
  const { identifier = '' } = useParams();
  const task = useTaskByIdentifier(identifier);

  if (task.data) return <Navigate to={`/p/${task.data.projectKey}/${task.data.number}`} replace />;
  if (task.error instanceof ApiError && task.error.status === 404)
    return <NotFoundPage title="Task not found" />;
  if (task.error) return <ErrorState error={task.error} onRetry={task.refetch} />;
  return <FullScreenLoader />;
}
