import { Navigate } from 'react-router';
import { useProjectContext } from '../useProjectContext';

export function ProjectIndexRedirect() {
  const project = useProjectContext();

  return <Navigate to={project.kind === 'household' ? 'home' : 'board'} replace />;
}
