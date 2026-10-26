import { CalendarDays, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCalendarConnections } from '../../calendar/api';
import { CalendarConnectionCard } from '../../calendar/components/CalendarConnectionCard';
import { CalendarFeedSection } from '../../calendar/components/CalendarFeedSection';
import { ICloudConnectDialog } from '../../calendar/components/ICloudConnectDialog';
import { SettingsSection } from '../components/SettingsSection';

const GOOGLE_RESULTS: Record<string, () => void> = {
  connected: () => toast.success('Google Calendar connected', { id: 'google-calendar' }),
  failed: () => toast.error("Google Calendar couldn't be connected. Try again.", { id: 'google-calendar' }),
  cancelled: () => toast.info('Google Calendar was not connected', { id: 'google-calendar' }),
};

export function CalendarSettings() {
  const [params, setParams] = useSearchParams();
  const [icloudOpen, setICloudOpen] = useState(false);
  const connections = useCalendarConnections();
  const googleResult = params.get('google');

  useEffect(() => {
    if (!googleResult) return;
    GOOGLE_RESULTS[googleResult]?.();
    setParams({}, { replace: true });
  }, [googleResult, setParams]);

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Connected calendars"
        description="See your Google and iCloud events next to your deadlines, and get warned when something clashes with a very important event."
      >
        <div className="flex flex-col gap-3">
          {connections.isPending && <Skeleton className="h-32" />}
          {connections.data?.connections.map((connection) => (
            <CalendarConnectionCard key={connection.id} connection={connection} />
          ))}
          <div className="flex flex-wrap gap-2">
            {connections.data?.googleAvailable && (
              <Button variant="secondary" leftIcon={<CalendarDays />} asChild>
                <a href="/api/calendar/google/connect">Connect Google Calendar</a>
              </Button>
            )}
            <Button variant="secondary" leftIcon={<CalendarDays />} onClick={() => setICloudOpen(true)}>
              Connect iCloud Calendar
            </Button>
          </div>
          {connections.data && !connections.data.googleAvailable && (
            <Banner icon={<Info />}>Google Calendar isn't set up on this server yet.</Banner>
          )}
          <p className="text-xs text-muted">
            Mark an event very important with the star in MSR Tracker, by coloring it Tomato in Google
            Calendar, or by switching on “Very important” for a whole calendar above.
          </p>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Subscribe from any calendar app"
        description="A private link with your events and deadlines. Works with Outlook, Google, Apple and Android calendars. Read-only, refreshed every few hours by your calendar app."
      >
        {connections.isPending ? (
          <Skeleton className="h-36" />
        ) : (
          <CalendarFeedSection feedUrl={connections.data?.feedUrl ?? null} />
        )}
      </SettingsSection>
      <ICloudConnectDialog open={icloudOpen} onOpenChange={setICloudOpen} />
    </div>
  );
}
