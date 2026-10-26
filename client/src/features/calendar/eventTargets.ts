import { can } from '@msr/shared/permissions';
import type { CalendarConnection, ProjectSummary } from '@msr/shared/types';
import type { PickerOption } from '../../components/ui/OptionPicker';

export interface EventTarget extends PickerOption {
  projectKey: string | null;
  calendar: { connectionId: string; calendarId: string } | null;
}

export const PERSONAL_TARGET = 'personal';

const PROVIDER_LABEL = { google: 'Google', icloud: 'iCloud' };

const projectTarget = (key: string) => `p:${key}`;
const calendarTarget = (connectionId: string, calendarId: string) => `c:${connectionId}:${calendarId}`;

export const eventTargets = (
  projects: ProjectSummary[],
  connections: CalendarConnection[],
): EventTarget[] => [
  {
    value: PERSONAL_TARGET,
    label: 'My events',
    description: 'Only in MSR Tracker',
    group: 'Personal',
    projectKey: null,
    calendar: null,
  },
  ...connections.flatMap((connection) =>
    connection.calendars
      .filter((calendar) => calendar.writable && calendar.show)
      .map((calendar) => ({
        value: calendarTarget(connection.id, calendar.id),
        label: calendar.name,
        color: calendar.color,
        group: `${PROVIDER_LABEL[connection.provider]} · ${connection.accountEmail}`,
        projectKey: null,
        calendar: { connectionId: connection.id, calendarId: calendar.id },
      })),
  ),
  ...projects
    .filter((project) => !project.isArchived && can(project.permissions, 'task.create'))
    .map((project) => ({
      value: projectTarget(project.key),
      label: project.name,
      color: project.color,
      description: 'Shared with project members',
      group: 'Projects',
      projectKey: project.key,
      calendar: null,
    })),
];

export const defaultTarget = (connections: CalendarConnection[], projectKey?: string) => {
  if (projectKey) return projectTarget(projectKey);
  const connection = connections.find((item) =>
    item.calendars.some(
      (calendar) => calendar.id === item.defaultCalendarId && calendar.writable && calendar.show,
    ),
  );
  return connection ? calendarTarget(connection.id, connection.defaultCalendarId!) : PERSONAL_TARGET;
};
