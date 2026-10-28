import { differenceInCalendarDays, format, formatDistanceToNowStrict, isThisYear, parseISO } from 'date-fns';

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'done';

export const toDate = (value: string) => (value.length === 10 ? parseISO(value) : new Date(value));

export const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export const dueState = (dueDate: string, done = false): DueState => {
  if (done) return 'done';
  const days = differenceInCalendarDays(toDate(dueDate), new Date());
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= 3 ? 'soon' : 'later';
};

export const formatShortDate = (value: string) => {
  const date = toDate(value);
  return format(date, isThisYear(date) ? 'MMM d' : 'MMM d, yyyy');
};

export const formatDue = (dueDate: string) => {
  const days = differenceInCalendarDays(toDate(dueDate), new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 6) return `In ${days} days`;
  return formatShortDate(dueDate);
};

export const formatRelative = (value: string) => `${formatDistanceToNowStrict(toDate(value))} ago`;

export const formatDateTime = (value: string) => format(toDate(value), 'MMM d, yyyy · HH:mm');

export const formatMinutes = (minutes: number) => {
  if (minutes >= 1440 && minutes % 1440 === 0) return minutes === 1440 ? '1 day' : `${minutes / 1440} days`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};
