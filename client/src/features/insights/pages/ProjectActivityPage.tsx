import { History } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useProjectContext } from '../../projects/useProjectContext';
import { ActivityItem } from '../../tasks/components/ActivityItem';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useProjectActivity } from '../api';

export function ProjectActivityPage() {
  const project = useProjectContext();
  const peek = useTaskPeek();
  const activity = useProjectActivity(project.key);
  const entries = activity.data?.pages.flatMap((page) => page.items) ?? [];

  if (activity.error) return <ErrorState error={activity.error} onRetry={activity.refetch} />;

  return (
    <Card className="flex flex-col gap-4">
      {activity.isPending && <Skeleton className="h-8" count={6} />}
      {!activity.isPending && !entries.length && (
        <EmptyState
          icon={<History />}
          title="No activity yet"
          description="Changes to tasks in this project will show up here."
        />
      )}
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          disabled={!entry.task?.id}
          onClick={() => entry.task && peek.open(entry.task.identifier)}
          className="cursor-pointer rounded-control p-1 text-left hover:bg-surface-muted disabled:cursor-default disabled:hover:bg-transparent"
        >
          <ActivityItem entry={entry} showTask />
        </button>
      ))}
      {activity.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={activity.isFetchingNextPage}
          onClick={() => activity.fetchNextPage()}
        >
          Load older activity
        </Button>
      )}
    </Card>
  );
}
