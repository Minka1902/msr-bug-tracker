import { z } from 'zod';
import { REMINDER_MAX_MINUTES } from '../calendar';
import { emailSchema } from './auth';
import { projectKeySchema, uuidSchema } from './project';

const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

const instant = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

const eventFields = {
  title: z.string().trim().min(1, 'Add a title').max(300),
  description: z.string().max(5000),
  location: z.string().trim().max(300),
  startsAt: instant,
  endsAt: instant,
  allDay: z.boolean(),
  important: z.boolean(),
  attendeeIds: z.array(uuidSchema).max(50),
  appointment: z.boolean(),
  reminders: z
    .array(z.int().min(0).max(REMINDER_MAX_MINUTES))
    .max(5)
    .transform((minutes) => [...new Set(minutes)].sort((a, b) => b - a)),
};

const endsAfterStart = (value: { startsAt?: string; endsAt?: string }) =>
  !value.startsAt || !value.endsAt || Date.parse(value.endsAt) >= Date.parse(value.startsAt);
const END_ORDER = { path: ['endsAt'], message: 'The end must be after the start' };

export const createEventSchema = z
  .object({
    ...eventFields,
    description: eventFields.description.default(''),
    location: eventFields.location.default(''),
    allDay: eventFields.allDay.default(false),
    important: eventFields.important.default(false),
    attendeeIds: eventFields.attendeeIds.default([]),
    appointment: eventFields.appointment.default(false),
    reminders: eventFields.reminders.default([]),
    projectKey: projectKeySchema.nullable().default(null),
    calendar: z
      .object({ connectionId: uuidSchema, calendarId: z.string().min(1).max(500) })
      .nullable()
      .default(null),
  })
  .refine(endsAfterStart, END_ORDER);

export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .strict()
  .refine(endsAfterStart, END_ORDER)
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const calendarQuerySchema = z
  .object({ from: isoDate, to: isoDate, projectKey: projectKeySchema.optional() })
  .refine(
    (value) =>
      Date.parse(value.to) >= Date.parse(value.from) &&
      Date.parse(value.to) - Date.parse(value.from) <= MAX_RANGE_DAYS * DAY_MS,
    'Pick a range of at most 400 days',
  );

export const conflictQuerySchema = z
  .object({
    userIds: z
      .string()
      .optional()
      .transform((value) => (value ? value.split(',').filter(Boolean) : []))
      .pipe(z.array(uuidSchema).max(50)),
    date: isoDate.optional(),
    startsAt: instant.optional(),
    endsAt: instant.optional(),
    allDay: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    excludeEventId: uuidSchema.optional(),
  })
  .refine((value) => value.date || (value.startsAt && value.endsAt), 'Give a date, or a start and an end');

export const icloudConnectSchema = z.object({
  appleId: emailSchema,
  appPassword: z
    .string()
    .trim()
    .regex(
      /^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i,
      'Use an app-specific password, like abcd-efgh-ijkl-mnop',
    ),
});

export const updateConnectionSchema = z
  .object({
    calendars: z
      .array(z.object({ id: z.string().min(1).max(500), show: z.boolean(), important: z.boolean() }))
      .max(100),
    defaultCalendarId: z.string().min(1).max(500).nullable(),
  })
  .partial()
  .strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
