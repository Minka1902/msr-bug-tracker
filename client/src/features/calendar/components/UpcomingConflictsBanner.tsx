import { format, parseISO } from 'date-fns';
import { TriangleAlert } from 'lucide-react';
import { Banner } from '../../../components/ui/Banner';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useUpcomingConflicts } from '../api';
import { formatWhen } from '../calendarDates';

interface UpcomingConflictsBannerProps {
  limit?: number;
  className?: string;
}

export function UpcomingConflictsBanner({ limit = 3, className }: UpcomingConflictsBannerProps) {
  const peek = useTaskPeek();
  const upcoming = useUpcomingConflicts();
  const conflicts = upcoming.data ?? [];

  if (!conflicts.length) return null;

  return (
    <Banner tone="warning" icon={<TriangleAlert />} className={className}>
      <p className="font-medium">
        {conflicts.length === 1
          ? 'Something coming up clashes with a very important event'
          : `${conflicts.length} things coming up clash with very important events`}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {conflicts.slice(0, limit).map(({ item, clashes }) => (
          <li key={`${item.kind}-${item.id}`}>
            {item.identifier ? (
              <button
                type="button"
                onClick={() => peek.open(item.identifier!)}
                className="cursor-pointer font-medium underline-offset-2 hover:underline"
              >
                {item.identifier} {item.title}
              </button>
            ) : (
              <span className="font-medium">{item.title}</span>
            )}{' '}
            ({format(parseISO(item.date), 'EEE, MMM d')}) overlaps{' '}
            {clashes
              .map(
                (clash) =>
                  `${clash.title} · ${formatWhen(clash)}${clash.personName ? ` · ${clash.personName}` : ''}`,
              )
              .join('; ')}
          </li>
        ))}
        {conflicts.length > limit && <li className="text-muted">and {conflicts.length - limit} more</li>}
      </ul>
    </Banner>
  );
}
