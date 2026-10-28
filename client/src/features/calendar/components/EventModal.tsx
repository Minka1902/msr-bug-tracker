import { addDays, addHours, format, parseISO, startOfHour } from 'date-fns';
import { CircleAlert, Lock, Star, Trash2 } from 'lucide-react';
import { DEFAULT_REMINDERS } from '@msr/shared/calendar';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { CalendarItem } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { DurationPicker } from '../../../components/ui/DurationPicker';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ReminderPicker } from '../../../components/ui/ReminderPicker';
import { Switch } from '../../../components/ui/Switch';
import { Textarea } from '../../../components/ui/Textarea';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useProject, useProjects } from '../../projects/api';
import { useCalendarConnections, useCreateEvent, useDeleteEvent, useUpdateEvent } from '../api';
import { fromLocalInputs, toLocalInputs } from '../calendarDates';
import { defaultTarget, eventTargets } from '../eventTargets';
import { useConflictGuard } from '../useConflictGuard';

export interface EventDefaults {
  date?: string;
  time?: string;
  projectKey?: string;
}

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarItem | null;
  defaults?: EventDefaults;
  lockTarget?: boolean;
  appointment?: boolean;
}

interface EventForm {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
  important: boolean;
  target: string | null;
  attendeeIds: string[];
  duration: number;
  reminders: number[];
}

const MAX_CONFLICT_PEOPLE = 50;
const DEFAULT_DURATION = 60;
const MINUTE_MS = 60_000;
const DAY_FORMAT = 'yyyy-MM-dd';

const formFor = (event: CalendarItem | null | undefined, defaults: EventDefaults): EventForm => {
  if (event) {
    const start = toLocalInputs(event.startsAt, event.allDay);
    const end = event.allDay
      ? { date: format(addDays(parseISO(event.endsAt.slice(0, 10)), -1), DAY_FORMAT), time: '' }
      : toLocalInputs(event.endsAt, false);
    return {
      title: event.title,
      allDay: event.allDay,
      startDate: start.date,
      startTime: event.allDay ? '09:00' : start.time,
      endDate: end.date < start.date ? start.date : end.date,
      endTime: event.allDay ? '10:00' : end.time,
      location: event.location,
      description: event.description,
      important: event.important,
      target: null,
      attendeeIds: event.attendees.map((person) => person.id),
      duration: Math.max(1, Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / MINUTE_MS)),
      reminders: event.reminders,
    };
  }
  const start = defaults.time
    ? new Date(`${defaults.date ?? format(new Date(), DAY_FORMAT)}T${defaults.time}`)
    : defaults.date
      ? new Date(`${defaults.date}T09:00`)
      : startOfHour(addHours(new Date(), 1));
  const end = addHours(start, 1);
  return {
    title: '',
    allDay: false,
    startDate: format(start, DAY_FORMAT),
    startTime: format(start, 'HH:mm'),
    endDate: format(end, DAY_FORMAT),
    endTime: format(end, 'HH:mm'),
    location: '',
    description: '',
    important: false,
    target: null,
    attendeeIds: [],
    duration: DEFAULT_DURATION,
    reminders: DEFAULT_REMINDERS,
  };
};

const rangeOf = (form: EventForm, appointment = false) => {
  if (appointment) {
    const startsAt = fromLocalInputs(form.startDate, form.startTime);
    return { startsAt, endsAt: new Date(Date.parse(startsAt) + form.duration * MINUTE_MS).toISOString() };
  }
  return form.allDay
    ? {
        startsAt: `${form.startDate}T00:00:00.000Z`,
        endsAt: `${format(addDays(parseISO(form.endDate < form.startDate ? form.startDate : form.endDate), 1), DAY_FORMAT)}T00:00:00.000Z`,
      }
    : {
        startsAt: fromLocalInputs(form.startDate, form.startTime),
        endsAt: fromLocalInputs(form.endDate, form.endTime),
      };
};

export function EventModal({
  open,
  onOpenChange,
  event,
  defaults = {},
  lockTarget,
  appointment,
}: EventModalProps) {
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const moveStart = (date: string, time: string) =>
    setForm((current) => {
      if (!date || (!current.allDay && !time)) return { ...current, startDate: date, startTime: time };
      const previous = rangeOf(current);
      const duration = Date.parse(previous.endsAt) - Date.parse(previous.startsAt);
      const start = new Date(`${date}T${current.allDay ? '00:00' : time}`);
      const end = new Date(start.getTime() + (current.allDay ? duration - 86_400_000 : duration));
      return {
        ...current,
        startDate: date,
        startTime: time,
        endDate: format(end, DAY_FORMAT),
        endTime: current.allDay ? current.endTime : format(end, 'HH:mm'),
      };
    });

  const close = () => {
    onOpenChange(false);
    create.reset();
    update.reset();
    remover.reset();
  };

  const done = (message: string) => () => {
    toast.success(message);
    close();
  };

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setTouched(true);
    if (invalid) return;
    const range = rangeOf(form, isAppointment);
    const people = form.attendeeIds.length
      ? form.attendeeIds
      : chosen?.projectKey
        ? (project.data?.memberList ?? []).map((member) => member.id)
        : [user.id];
    const proceed = await guard({
      userIds: people.slice(0, MAX_CONFLICT_PEOPLE),
      ...range,
      allDay: !isAppointment && form.allDay,
      excludeEventId: event?.id,
    });
    if (!proceed) return;
    const fields = {
      title: form.title.trim(),
      description: form.description,
      location: form.location.trim(),
      allDay: !isAppointment && form.allDay,
      important: form.important,
      appointment: isAppointment,
      reminders: isAppointment ? form.reminders : [],
      ...range,
    };
    if (event)
      update.mutate(
        { id: event.id, patch: { ...fields, ...(event.project ? { attendeeIds: form.attendeeIds } : {}) } },
        { onSuccess: done(isAppointment ? 'Appointment saved' : 'Event saved') },
      );
    else
      create.mutate(
        {
          ...fields,
          projectKey: chosen?.projectKey ?? null,
          calendar: chosen?.calendar ?? null,
          attendeeIds: chosen?.projectKey ? form.attendeeIds : [],
        },
        { onSuccess: done(isAppointment ? 'Appointment added' : 'Event added') },
      );
  };

  const remove = async () => {
    if (!event) return;
    const confirmed = await confirm({
      title: 'Delete this event?',
      description: event.source === 'app' ? undefined : `It is also removed from ${event.calendarName}.`,
      confirmLabel: 'Delete event',
    });
    if (confirmed) remover.mutate(event.id, { onSuccess: done('Event deleted') });
  };

  const user = useCurrentUser();
  const confirm = useConfirm();
  const guard = useConflictGuard();
  const projects = useProjects();
  const connections = useCalendarConnections();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remover = useDeleteEvent();
  const isAppointment = event ? event.appointment : !!appointment;
  const noun = isAppointment ? 'appointment' : 'event';
  const [form, setForm] = useState(() => formFor(event, defaults));
  const [touched, setTouched] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  const targets = eventTargets(projects.data ?? [], connections.data?.connections ?? []);
  const targetValue = form.target ?? defaultTarget(connections.data?.connections ?? [], defaults.projectKey);
  const chosen = event ? null : targets.find((target) => target.value === targetValue);
  const projectKey = event ? event.project?.key : chosen?.projectKey;
  const project = useProject(projectKey ?? '');
  const readOnly = !!event && !event.editable;
  const range = rangeOf(form, isAppointment);
  const endError =
    form.allDay || isAppointment
      ? undefined
      : Date.parse(range.endsAt) <= Date.parse(range.startsAt)
        ? 'The end must be after the start'
        : undefined;
  const titleError = form.title.trim() ? undefined : 'Add a title';
  const invalid = !!(titleError || endError || !form.startDate || !form.endDate);
  const error = create.error ?? update.error ?? remover.error;
  const busy = create.isPending || update.isPending || remover.isPending;

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(formFor(event, defaults));
      setTouched(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={event ? (readOnly ? event.title : `Edit ${noun}`) : `New ${noun}`}
      description={event ? event.calendarName : undefined}
      footer={
        <>
          {event && !readOnly && (
            <Button
              variant="ghost"
              leftIcon={<Trash2 />}
              onClick={remove}
              disabled={busy}
              className="mr-auto text-danger"
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={close}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button type="submit" form="event-form" loading={create.isPending || update.isPending}>
              {event ? 'Save' : `Add ${noun}`}
            </Button>
          )}
        </>
      }
    >
      <form id="event-form" onSubmit={submit} noValidate>
        <fieldset disabled={readOnly || busy} className="flex flex-col gap-4">
          {readOnly && (
            <Banner icon={<Lock />}>
              {event.source === 'app'
                ? 'Only the person who added this event or a project admin can change it.'
                : `${event.calendarName} is read-only.`}
            </Banner>
          )}
          {!!error && (
            <Banner tone="danger" icon={<CircleAlert />}>
              {errorMessage(error)}
            </Banner>
          )}
          <Field label="Title" htmlFor="event-title" error={touched ? titleError : undefined}>
            <Input
              id="event-title"
              autoFocus={!event}
              value={form.title}
              maxLength={300}
              invalid={touched && !!titleError}
              onChange={(change) => set('title', change.target.value)}
            />
          </Field>
          {isAppointment ? (
            <>
              <Field label="Where" htmlFor="event-location">
                <Input
                  id="event-location"
                  value={form.location}
                  maxLength={300}
                  placeholder="Clinic, school or address"
                  onChange={(change) => set('location', change.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <Field label="When">
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      aria-label="Date"
                      value={form.startDate}
                      onChange={(change) => set('startDate', change.target.value)}
                    />
                    <Input
                      type="time"
                      aria-label="Time"
                      value={form.startTime}
                      wrapperClassName="w-36 shrink-0"
                      onChange={(change) => set('startTime', change.target.value)}
                    />
                  </div>
                </Field>
                <Field label="How long">
                  <DurationPicker
                    value={form.duration}
                    onChange={(minutes) => set('duration', minutes)}
                    className="w-full"
                  />
                </Field>
              </div>
              <Field label="Remind" hint="The household's Telegram chats get the reminder.">
                <ReminderPicker value={form.reminders} onChange={(minutes) => set('reminders', minutes)} />
              </Field>
            </>
          ) : (
            <Switch
              checked={form.allDay}
              onCheckedChange={(checked) => set('allDay', checked)}
              label="All day"
              size="sm"
            />
          )}
          {!isAppointment && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    aria-label="Start date"
                    value={form.startDate}
                    onChange={(change) => moveStart(change.target.value, form.startTime)}
                  />
                  {!form.allDay && (
                    <Input
                      type="time"
                      aria-label="Start time"
                      value={form.startTime}
                      wrapperClassName="w-36 shrink-0"
                      onChange={(change) => moveStart(form.startDate, change.target.value)}
                    />
                  )}
                </div>
              </Field>
              <Field label="Ends" error={touched ? endError : undefined}>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    aria-label="End date"
                    value={form.endDate}
                    min={form.startDate}
                    invalid={touched && !!endError}
                    onChange={(change) => set('endDate', change.target.value)}
                  />
                  {!form.allDay && (
                    <Input
                      type="time"
                      aria-label="End time"
                      value={form.endTime}
                      wrapperClassName="w-36 shrink-0"
                      invalid={touched && !!endError}
                      onChange={(change) => set('endTime', change.target.value)}
                    />
                  )}
                </div>
              </Field>
            </div>
          )}
          {!event && !lockTarget && (
            <Field label="Calendar">
              <OptionPicker
                aria-label="Calendar"
                value={targetValue}
                onChange={(next) => {
                  if (!next) return;
                  set('target', next);
                  set('attendeeIds', []);
                }}
                options={targets}
                searchable={targets.length > 8}
                className="w-full"
              />
            </Field>
          )}
          {projectKey && (
            <Field label="Who's going" hint="Leave empty if it's for everyone in the project.">
              <OptionPicker
                multiple
                aria-label="Who's going"
                placeholder="Everyone"
                value={form.attendeeIds}
                onChange={(next) => set('attendeeIds', next)}
                options={(project.data?.memberList ?? []).map((member) => ({
                  value: member.id,
                  label: member.name,
                  description: member.email,
                }))}
                searchable
                className="w-full"
              />
            </Field>
          )}
          {!isAppointment && (
            <Field label="Location" htmlFor="event-location">
              <Input
                id="event-location"
                value={form.location}
                maxLength={300}
                onChange={(change) => set('location', change.target.value)}
              />
            </Field>
          )}
          <Field label="Notes" htmlFor="event-notes">
            <Textarea
              id="event-notes"
              value={form.description}
              maxLength={5000}
              onChange={(change) => set('description', change.target.value)}
            />
          </Field>
          <Switch
            checked={form.important}
            onCheckedChange={(checked) => set('important', checked)}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 fill-highlight text-highlight" aria-hidden />
                Very important
              </span>
            }
            aria-label="Very important"
            description="Deadlines and meetings that overlap it get a warning."
          />
        </fieldset>
      </form>
    </Modal>
  );
}
