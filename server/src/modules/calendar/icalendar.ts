import ICAL from 'ical.js';
import type { EventDraft, ExternalEvent } from './types';

const PRODID = '-//MSR Tracker//Calendar//EN';
const MAX_OCCURRENCES = 500;
const IMPORTANT_PRIORITY = 1;

const toIso = (time: ICAL.Time) =>
  time.isDate ? `${time.toString().slice(0, 10)}T00:00:00.000Z` : time.toJSDate().toISOString();

const timeOf = (iso: string, allDay: boolean) =>
  allDay ? ICAL.Time.fromDateString(iso.slice(0, 10)) : ICAL.Time.fromJSDate(new Date(iso), true);

const setText = (vevent: ICAL.Component, name: string, value: string) => {
  vevent.removeAllProperties(name);
  if (value) vevent.addPropertyWithValue(name, value);
};

const setTime = (vevent: ICAL.Component, name: string, time: ICAL.Time) => {
  vevent.removeAllProperties(name);
  const property = new ICAL.Property(name);
  if (time.isDate) property.resetType('date');
  property.setValue(time);
  vevent.addProperty(property);
};

export const applyDraft = (vevent: ICAL.Component, draft: EventDraft) => {
  setText(vevent, 'summary', draft.title);
  setText(vevent, 'description', draft.description);
  setText(vevent, 'location', draft.location);
  setTime(vevent, 'dtstart', timeOf(draft.startsAt, draft.allDay));
  setTime(vevent, 'dtend', timeOf(draft.endsAt, draft.allDay));
  vevent.removeAllProperties('priority');
  if (draft.important) vevent.addPropertyWithValue('priority', IMPORTANT_PRIORITY);
  setTime(vevent, 'dtstamp', ICAL.Time.fromJSDate(new Date(), true));
  return vevent;
};

export const newCalendar = () => {
  const calendar = new ICAL.Component(['vcalendar', [], []]);
  calendar.addPropertyWithValue('prodid', PRODID);
  calendar.addPropertyWithValue('version', '2.0');
  return calendar;
};

export const buildEvent = (uid: string, draft: EventDraft, extra: Record<string, string> = {}) => {
  const vevent = new ICAL.Component('vevent');
  vevent.addPropertyWithValue('uid', uid);
  applyDraft(vevent, draft);
  Object.entries(extra).forEach(([name, value]) => vevent.addPropertyWithValue(name, value));
  return vevent;
};

export const buildCalendarObject = (uid: string, draft: EventDraft) => {
  const calendar = newCalendar();
  calendar.addSubcomponent(buildEvent(uid, draft));
  return calendar.toString();
};

export const updateCalendarObject = (data: string, draft: EventDraft) => {
  const calendar = new ICAL.Component(ICAL.parse(data));
  const master =
    calendar.getAllSubcomponents('vevent').find((vevent) => !vevent.hasProperty('recurrence-id')) ??
    calendar.getFirstSubcomponent('vevent');
  if (!master) throw new Error('No event in calendar object');
  applyDraft(master, draft);
  return calendar.toString();
};

export const parseCalendarObject = (
  data: string,
  objectUrl: string,
  calendarId: string,
  etag: string | null,
  readOnly: boolean,
  from: Date,
  to: Date,
): ExternalEvent[] => {
  const calendar = new ICAL.Component(ICAL.parse(data));
  calendar.getAllSubcomponents('vtimezone').forEach((zone) => ICAL.TimezoneService.register(zone));
  const vevents = calendar.getAllSubcomponents('vevent');
  const master = vevents.find((vevent) => !vevent.hasProperty('recurrence-id')) ?? vevents[0];
  if (!master) return [];
  const event = new ICAL.Event(master, {
    exceptions: vevents.filter((vevent) => vevent.hasProperty('recurrence-id')),
  });
  const base = {
    calendarId,
    etag,
    title: event.summary || '(No title)',
    description: event.description ?? '',
    location: event.location ?? '',
    important: Number(master.getFirstPropertyValue('priority')) === IMPORTANT_PRIORITY,
  };
  if (!event.isRecurring())
    return [
      {
        ...base,
        externalId: objectUrl,
        startsAt: toIso(event.startDate),
        endsAt: toIso(event.endDate ?? event.startDate),
        allDay: event.startDate.isDate,
        readOnly,
      },
    ];
  const occurrences: ExternalEvent[] = [];
  const iterator = event.iterator();
  for (
    let next = iterator.next(), count = 0;
    next && count < MAX_OCCURRENCES;
    next = iterator.next(), count += 1
  ) {
    if (next.toJSDate() > to) break;
    const details = event.getOccurrenceDetails(next);
    if (details.endDate.toJSDate() < from) continue;
    occurrences.push({
      ...base,
      title: details.item.summary || base.title,
      externalId: `${objectUrl}#${next.toString()}`,
      startsAt: toIso(details.startDate),
      endsAt: toIso(details.endDate),
      allDay: details.startDate.isDate,
      readOnly: true,
    });
  }
  return occurrences;
};
