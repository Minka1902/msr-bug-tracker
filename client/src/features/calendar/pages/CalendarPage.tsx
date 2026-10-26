import { Settings2 } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { CalendarView } from '../components/CalendarView';
import { UpcomingConflictsBanner } from '../components/UpcomingConflictsBanner';

export function CalendarPage() {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title="Calendar"
        description="Your events, your task deadlines and your connected calendars in one place."
        actions={
          <Button variant="secondary" leftIcon={<Settings2 />} asChild>
            <Link to="/settings/calendars">Connect calendars</Link>
          </Button>
        }
      />
      <UpcomingConflictsBanner />
      <CalendarView />
    </div>
  );
}
