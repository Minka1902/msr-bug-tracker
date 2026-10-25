import { useNavigate, useParams } from 'react-router';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { TaskDetail } from '../detail/TaskDetail';

export function TaskPage() {
  const navigateTo = (identifier: string, { replace = false } = {}) => {
    const [projectKey, number] = identifier.split('-');
    navigate(`/p/${projectKey}/${number}`, { replace });
  };

  const { key = '', number = '' } = useParams();
  const navigate = useNavigate();

  if (!/^\d+$/.test(number)) return <NotFoundPage />;

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <TaskDetail
        key={`${key}-${number}`}
        identifier={`${key}-${number}`}
        variant="page"
        onNavigate={navigateTo}
      />
    </div>
  );
}
