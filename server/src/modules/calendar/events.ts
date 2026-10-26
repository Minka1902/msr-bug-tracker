import type { CreateEventInput } from '@msr/shared/schemas/calendar';
import { badRequest } from '../../lib/httpError';
import { assertCanWrite, findProjectContext } from '../projects/access';
import { assertProjectAttendees, getConnection, insertEvent, normalizeRange } from './service';
import { connectionClient } from './sync';

export const createEvent = async (userId: string, input: CreateEventInput) => {
  const range = normalizeRange(input.startsAt, input.endsAt, input.allDay);
  const fields = { ...input, ...range };
  let projectId: string | null = null;
  if (input.projectKey) {
    const project = await findProjectContext(input.projectKey, userId);
    assertCanWrite(project, 'task.create');
    if (input.calendar)
      throw badRequest('Project events stay in MSR. Only personal events can go to Google or iCloud.');
    if (!(await assertProjectAttendees(project.id, input.attendeeIds)))
      throw badRequest('Attendees must be members of the project');
    projectId = project.id;
  } else if (input.attendeeIds.length) throw badRequest('Pick a project to invite people to an event');
  let external = null;
  if (input.calendar) {
    const connection = await getConnection(input.calendar.connectionId, userId);
    const calendar = connection?.calendars.find(
      (item) => item.id === input.calendar!.calendarId && item.writable,
    );
    if (!connection || !calendar) throw badRequest('Pick a calendar you can write to');
    const { provider, credentials } = connectionClient(connection);
    external = {
      connectionId: connection.id,
      calendarId: calendar.id,
      ...(await provider.createEvent(credentials, calendar.id, fields)),
    };
  }
  return insertEvent({
    ...fields,
    ownerId: projectId ? null : userId,
    projectId,
    createdBy: userId,
    external,
  });
};
