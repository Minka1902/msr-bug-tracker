import { CalendarPlus, Copy, Link2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { QrCode } from '../../../components/ui/QrCode';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { useRegenerateFeed } from '../api';

interface CalendarFeedSectionProps {
  feedUrl: string | null;
}

export function CalendarFeedSection({ feedUrl }: CalendarFeedSectionProps) {
  const regenerate = async () => {
    if (
      feedUrl &&
      !(await confirm({
        title: 'Make a new link?',
        description:
          'The current link stops working. Calendars subscribed to it stop updating until you add the new one.',
        confirmLabel: 'Make new link',
      }))
    )
      return;
    create.mutate(undefined, { onError: (error) => toast.error(errorMessage(error)) });
  };

  const confirm = useConfirm();
  const create = useRegenerateFeed();

  if (!feedUrl)
    return (
      <Button leftIcon={<Link2 />} loading={create.isPending} onClick={regenerate}>
        Create my calendar link
      </Button>
    );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <QrCode
        value={feedUrl.replace(/^https?:/, 'webcal:')}
        size={144}
        title="Calendar subscription QR code"
        downloadName="msr-calendar"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <code className="rounded-control border border-border bg-surface-muted/60 px-3 py-2 font-mono text-xs break-all">
          {feedUrl}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" leftIcon={<Copy />} onClick={() => copyText(feedUrl, 'Calendar link')}>
            Copy link
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<CalendarPlus />} asChild>
            <a href={feedUrl.replace(/^https?:/, 'webcal:')}>Subscribe on this device</a>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RefreshCw />}
            loading={create.isPending}
            onClick={regenerate}
          >
            New link
          </Button>
        </div>
        <p className="text-xs text-muted">
          Anyone with this link can see your schedule, so keep it private. Google Calendar: Other calendars →
          From URL. Apple Calendar: File → New Calendar Subscription, or scan the code on your iPhone.
        </p>
      </div>
    </div>
  );
}
