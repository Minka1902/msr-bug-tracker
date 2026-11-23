import type { ActivityEntry } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { formatDateTime, formatRelative } from '../../../lib/dates';
import { activityText } from '../activityText';

interface ActivityItemProps {
  entry: ActivityEntry;
  showTask?: boolean;
}

const AUTOMATIC_ACTORS: Record<string, string> = {
  escalated: 'Priority schedule',
  carried_over: 'Carry over',
};

export function ActivityItem({ entry, showTask }: ActivityItemProps) {
  const automatic = entry.actor ? undefined : AUTOMATIC_ACTORS[entry.action];

  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Avatar
        name={entry.actor?.name ?? automatic ?? 'Deleted user'}
        src={entry.actor?.avatarUrl}
        size="sm"
        className="mt-0.5"
      />
      <p className="min-w-0 flex-1 leading-relaxed text-muted">
        <span className="font-medium text-text">{entry.actor?.name ?? automatic ?? 'Someone'}</span>{' '}
        {activityText(entry)}
        {showTask && entry.task && (
          <>
            {' '}
            on <span className="font-medium text-text">{entry.task.identifier}</span>
            <span className="text-text"> {entry.task.title}</span>
          </>
        )}
        <span title={formatDateTime(entry.createdAt)} className="ml-1.5 text-xs text-subtle">
          {formatRelative(entry.createdAt)}
        </span>
      </p>
    </div>
  );
}
