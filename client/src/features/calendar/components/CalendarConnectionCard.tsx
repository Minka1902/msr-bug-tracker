import { CalendarDays, CircleAlert, RefreshCw, Unplug } from 'lucide-react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import type { CalendarConnection, ExternalCalendarSettings } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Switch } from '../../../components/ui/Switch';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { formatRelative } from '../../../lib/dates';
import { useDisconnectCalendar, useSyncConnection, useUpdateConnection } from '../api';

interface CalendarConnectionCardProps {
  connection: CalendarConnection;
}

const PROVIDER_LABEL = { google: 'Google Calendar', icloud: 'iCloud Calendar' };

export function CalendarConnectionCard({ connection }: CalendarConnectionCardProps) {
  const onError = { onError: (error: Error) => toast.error(errorMessage(error)) };

  const toggle = (
    calendar: ExternalCalendarSettings,
    change: Partial<Pick<ExternalCalendarSettings, 'show' | 'important'>>,
  ) =>
    update.mutate(
      {
        id: connection.id,
        calendars: connection.calendars.map((item) => ({
          id: item.id,
          show: item.show,
          important: item.important,
          ...(item.id === calendar.id ? change : {}),
        })),
      },
      onError,
    );

  const disconnect = async () => {
    const confirmed = await confirm({
      title: `Disconnect ${connection.accountEmail}?`,
      description: 'Its events disappear from MSR Tracker. Nothing is deleted from your calendar.',
      confirmLabel: 'Disconnect',
    });
    if (confirmed)
      remove.mutate(connection.id, { onSuccess: () => toast.success('Calendar disconnected'), ...onError });
  };

  const confirm = useConfirm();
  const update = useUpdateConnection();
  const sync = useSyncConnection();
  const remove = useDisconnectCalendar();
  const writable = connection.calendars.filter((calendar) => calendar.writable && calendar.show);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-control bg-accent-soft text-accent-text">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{PROVIDER_LABEL[connection.provider]}</p>
          <p className="truncate text-xs text-muted">
            {connection.accountEmail}
            {connection.lastSyncedAt && ` · synced ${formatRelative(connection.lastSyncedAt)}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<RefreshCw />}
          loading={sync.isPending}
          onClick={() =>
            sync.mutate(connection.id, { onSuccess: () => toast.success('Calendar synced'), ...onError })
          }
        >
          Sync now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Unplug />}
          loading={remove.isPending}
          onClick={disconnect}
        >
          Disconnect
        </Button>
      </div>
      {connection.syncError && (
        <Banner tone="danger" icon={<CircleAlert />}>
          The last sync failed: {connection.syncError}
        </Banner>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
        <li className="hidden grid-cols-[1fr_5rem_8rem] gap-3 px-3 py-1.5 text-[11px] font-medium text-muted sm:grid">
          <span>Calendar</span>
          <span>Show</span>
          <span>Very important</span>
        </li>
        {connection.calendars.map((calendar) => (
          <li
            key={calendar.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm sm:grid-cols-[1fr_5rem_8rem]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                style={{ '--c': calendar.color } as CSSProperties}
                className="size-2.5 shrink-0 rounded-full bg-(--c)"
                aria-hidden
              />
              <span className="truncate">{calendar.name}</span>
              {!calendar.writable && <span className="shrink-0 text-xs text-subtle">read-only</span>}
            </span>
            <Switch
              size="sm"
              checked={calendar.show}
              aria-label={`Show ${calendar.name}`}
              onCheckedChange={(show) => toggle(calendar, { show })}
            />
            <Switch
              size="sm"
              checked={calendar.important}
              aria-label={`Treat everything in ${calendar.name} as very important`}
              onCheckedChange={(important) => toggle(calendar, { important })}
            />
          </li>
        ))}
      </ul>
      {writable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">New events go to</span>
          <OptionPicker
            aria-label="Default calendar for new events"
            value={
              writable.some((calendar) => calendar.id === connection.defaultCalendarId)
                ? connection.defaultCalendarId
                : null
            }
            placeholder="MSR Tracker only"
            clearable
            onChange={(defaultCalendarId) => update.mutate({ id: connection.id, defaultCalendarId }, onError)}
            options={writable.map((calendar) => ({
              value: calendar.id,
              label: calendar.name,
              color: calendar.color,
            }))}
            className="h-8 w-56 text-xs"
          />
        </div>
      )}
    </div>
  );
}
