export interface EventDraft {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  important: boolean;
}

export interface ExternalEvent extends EventDraft {
  calendarId: string;
  externalId: string;
  etag: string | null;
  readOnly: boolean;
}

export interface ExternalCalendar {
  id: string;
  name: string;
  color: string;
  writable: boolean;
  selected: boolean;
}

export interface CalendarProvider<C> {
  listCalendars: (credentials: C) => Promise<ExternalCalendar[]>;
  listEvents: (credentials: C, calendar: ExternalCalendar, from: Date, to: Date) => Promise<ExternalEvent[]>;
  createEvent: (
    credentials: C,
    calendarId: string,
    draft: EventDraft,
  ) => Promise<{ externalId: string; etag: string | null }>;
  updateEvent: (
    credentials: C,
    calendarId: string,
    externalId: string,
    etag: string | null,
    draft: EventDraft,
  ) => Promise<{ etag: string | null }>;
  deleteEvent: (credentials: C, calendarId: string, externalId: string, etag: string | null) => Promise<void>;
}
