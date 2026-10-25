import { History } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useTaskActivity } from '../api';
import { ActivityItem } from '../components/ActivityItem';

export function ActivityFeed({ taskId }: { taskId: string }) {
  const activity = useTaskActivity(taskId);

  if (activity.isPending) return <Skeleton className="h-8" count={4} />;
  if (!activity.data?.length) return <EmptyState compact icon={<History />} title="No activity yet" />;

  return (
    <div className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-border">
      {activity.data.map((entry) => (
        <div key={entry.id} className="relative">
          <ActivityItem entry={entry} />
        </div>
      ))}
    </div>
  );
}
