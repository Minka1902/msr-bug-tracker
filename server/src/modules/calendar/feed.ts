import { addDays } from '@msr/shared/calendar';
import { config } from '../../config';
import { buildEvent, newCalendar } from './icalendar';
import { listCalendarItems } from './service';

const DAYS_BACK = 60;
const DAYS_AHEAD = 365;

export const feedUrlOf = (token: string) => `${config.APP_URL}/api/calendar-feed/${token}.ics`;

export const buildFeed = async (userId: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const items = await listCalendarItems(
    userId,
    addDays(today, -DAYS_BACK),
    addDays(today, DAYS_AHEAD),
    null,
    false,
  );
  const calendar = newCalendar();
  calendar.addPropertyWithValue('x-wr-calname', 'MSR Tracker');
  items.forEach((item) =>
    calendar.addSubcomponent(
      buildEvent(
        `${item.kind}-${item.id}@msr-tracker`,
        {
          title: item.taskIdentifier ? `${item.taskIdentifier} ${item.title}` : item.title,
          description: item.description,
          location: item.location,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          allDay: item.allDay,
          important: item.important,
        },
        item.taskIdentifier ? { url: `${config.APP_URL}/t/${item.taskIdentifier}` } : {},
      ),
    ),
  );
  return calendar.toString();
};
