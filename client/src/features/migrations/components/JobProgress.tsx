import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Spinner } from '../../../components/ui/Spinner';
import type { MigrationJob } from '../api';

interface JobProgressProps {
  job: Pick<MigrationJob, 'progress'>;
}

export function JobProgress({ job }: JobProgressProps) {
  const { message, done, total } = job.progress;

  return (
    <div role="status" className="flex flex-col items-center gap-4 py-8 text-center">
      <Spinner className="size-7 text-accent" />
      <div>
        <p className="font-medium">{message}…</p>
        <p className="text-sm text-muted">
          {total ? `${done} of ${total}` : done ? `${done} so far` : 'Starting'}
        </p>
      </div>
      {!!total && (
        <ProgressBar value={(done / total) * 100} className="w-full max-w-sm" aria-label={message} />
      )}
    </div>
  );
}
