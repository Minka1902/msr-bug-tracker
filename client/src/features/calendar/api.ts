import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventInput, UpdateEventInput } from '@msr/shared/schemas/calendar';
import type { CalendarConflict, CalendarConnection, CalendarItem, UpcomingConflict } from '@msr/shared/types';
import { api } from '../../lib/api';

export interface ConflictTarget {
  userIds?: string[];
  date?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  excludeEventId?: string;
}

export interface ConnectionsResponse {
  connections: CalendarConnection[];
  feedUrl: string | null;
  googleAvailable: boolean;
}

const REFRESH_MS = 60_000;

export const calendarKeys = {
  all: ['calendar'] as const,
  items: (from: string, to: string, projectKey?: string) =>
    ['calendar', 'items', from, to, projectKey ?? null] as const,
  upcoming: ['calendar', 'upcoming'] as const,
  connections: ['calendar', 'connections'] as const,
};

const useInvalidateCalendar = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: calendarKeys.all });
};

export const fetchConflicts = (target: ConflictTarget) =>
  api<{ conflicts: CalendarConflict[] }>('/calendar/conflicts', { query: { ...target } }).then(
    (data) => data.conflicts,
  );

export const useCalendarItems = (from: string, to: string, projectKey?: string) =>
  useQuery({
    queryKey: calendarKeys.items(from, to, projectKey),
    queryFn: () =>
      api<{ items: CalendarItem[] }>('/calendar/events', { query: { from, to, projectKey } }).then(
        (data) => data.items,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

export const useUpcomingConflicts = () =>
  useQuery({
    queryKey: calendarKeys.upcoming,
    queryFn: () =>
      api<{ conflicts: UpcomingConflict[] }>('/calendar/conflicts/upcoming').then((data) => data.conflicts),
  });

export const useCreateEvent = () => {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (
      input: Partial<CreateEventInput> & Pick<CreateEventInput, 'title' | 'startsAt' | 'endsAt'>,
    ) =>
      api<{ event: CalendarItem }>('/calendar/events', { method: 'POST', body: input }).then(
        (data) => data.event,
      ),
    onSuccess: invalidate,
  });
};

export const useUpdateEvent = () => {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateEventInput }) =>
      api<{ event: CalendarItem }>(`/calendar/events/${id}`, { method: 'PATCH', body: patch }).then(
        (data) => data.event,
      ),
    onSuccess: invalidate,
  });
};

export const useDeleteEvent = () => {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => api(`/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
};

export const useCalendarConnections = () =>
  useQuery({
    queryKey: calendarKeys.connections,
    queryFn: () => api<ConnectionsResponse>('/calendar/connections'),
  });

const useConnectionMutation = <T>(request: (input: T) => Promise<unknown>) => {
  const invalidate = useInvalidateCalendar();
  return useMutation({ mutationFn: request, onSuccess: invalidate });
};

export const useUpdateConnection = () =>
  useConnectionMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      calendars?: { id: string; show: boolean; important: boolean }[];
      defaultCalendarId?: string | null;
    }) => api(`/calendar/connections/${id}`, { method: 'PATCH', body }),
  );

export const useSyncConnection = () =>
  useConnectionMutation((id: string) => api(`/calendar/connections/${id}/sync`, { method: 'POST' }));

export const useDisconnectCalendar = () =>
  useConnectionMutation((id: string) => api(`/calendar/connections/${id}`, { method: 'DELETE' }));

export const useConnectICloud = () =>
  useConnectionMutation((input: { appleId: string; appPassword: string }) =>
    api('/calendar/icloud/connect', { method: 'POST', body: input }),
  );

export const useRegenerateFeed = () =>
  useConnectionMutation(() => api<{ feedUrl: string }>('/calendar/feed', { method: 'POST' }));
