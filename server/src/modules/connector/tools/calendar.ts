import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addDays } from '@msr/shared/calendar';
import { calendarQuerySchema, createEventSchema } from '@msr/shared/schemas/calendar';
import type { CalendarItem } from '@msr/shared/types';
import { z } from 'zod';
import { createEvent } from '../../calendar/events';
import { getCalendarItem, listCalendarItems } from '../../calendar/service';
import { findProjectContext } from '../../projects/access';
import { taskUrl } from '../format';
import { READ, run, WRITE, type ToolContext } from '../tool';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const projectKey = z.string().trim().min(2).max(6).describe('Project key, to include or add a project event');

const toInstant = (value: string, inclusiveEnd = false) =>
  DATE_ONLY.test(value) ? `${inclusiveEnd ? addDays(value, 1) : value}T00:00:00Z` : value;

const compactItem = (item: CalendarItem) => ({
  title: item.title,
  kind: item.kind,
  startsAt: item.startsAt,
  endsAt: item.endsAt,
  allDay: item.allDay,
  ...(item.important && { important: true }),
  ...(item.appointment && { appointment: true }),
  ...(item.reminders.length && { remindMinutesBefore: item.reminders }),
  calendar: item.calendarName,
  ...(item.project && { project: item.project.key }),
  ...(item.location && { location: item.location }),
  ...(item.attendees.length && { attendees: item.attendees.map((person) => person.name) }),
  ...(item.taskIdentifier && { task: item.taskIdentifier, url: taskUrl(item.taskIdentifier) }),
});

export const registerCalendarTools = (server: McpServer, context: ToolContext) => {
  const { user } = context;

  server.registerTool(
    'list_calendar',
    {
      title: 'Calendar',
      description:
        'Lists events and task deadlines between two dates: your own events, events of your projects, synced Google and iCloud events, and due dates.',
      inputSchema: {
        from: z.iso.date().describe('First day, YYYY-MM-DD'),
        to: z.iso.date().describe('Last day, YYYY-MM-DD (at most 400 days after from)'),
        projectKey: projectKey.optional(),
      },
      annotations: READ,
    },
    run(async (input) => {
      const query = calendarQuerySchema.parse({ ...input, projectKey: input.projectKey?.toUpperCase() });
      const project = query.projectKey ? await findProjectContext(query.projectKey, user.id) : null;
      return {
        items: (await listCalendarItems(user.id, query.from, query.to, project?.id ?? null)).map(compactItem),
      };
    }),
  );

  if (!context.canWrite) return;

  server.registerTool(
    'create_event',
    {
      title: 'Create a calendar event',
      description:
        'Adds an event to your MSR calendar, or to a project calendar when you pass a project key. Times are ISO 8601 with an offset, for example 2026-11-02T09:30:00+02:00.',
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        startsAt: z.string().describe('ISO 8601 start, or a date for all-day events'),
        endsAt: z.string().describe('ISO 8601 end, or the last date for all-day events'),
        allDay: z.boolean().default(false),
        important: z
          .boolean()
          .default(false)
          .describe('Very important: others get warned when a deadline clashes'),
        description: z.string().max(5000).optional(),
        location: z.string().max(200).optional(),
        projectKey: projectKey.optional(),
        appointment: z
          .boolean()
          .default(false)
          .describe('A household appointment, like a doctor visit; needs a household project key and a start time'),
        reminders: z
          .array(z.number().int().min(0).max(10_080))
          .max(5)
          .default([])
          .describe('Appointments only: remind this many minutes before, for example [1440, 60]'),
      },
      annotations: WRITE,
    },
    run(async (input) => {
      const id = await createEvent(
        user.id,
        createEventSchema.parse({
          ...input,
          startsAt: toInstant(input.startsAt),
          endsAt: toInstant(input.endsAt, true),
          projectKey: input.projectKey?.toUpperCase() ?? null,
        }),
      );
      return { event: compactItem((await getCalendarItem(user.id, id))!) };
    }),
  );
};
