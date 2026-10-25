import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { Workflow } from '@msr/shared/enums';
import type { BulkPatch, CreateTaskInput, UpdateTaskInput } from '@msr/shared/schemas/task';
import type { FilterValues } from '../../hooks/useUrlFilters';
import type { ActivityEntry, BoardColumn, Page, TaskCard, TaskDetail } from '@msr/shared/types';
import { api } from '../../lib/api';
import { projectKeys } from '../projects/api';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (scope: string, filters: FilterValues) => ['tasks', 'list', scope, filters] as const,
  boards: ['tasks', 'board'] as const,
  board: (key: string, workflow: Workflow, filters: FilterValues) =>
    ['tasks', 'board', key.toUpperCase(), workflow, filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  identifier: (identifier: string) => ['tasks', 'identifier', identifier.toUpperCase()] as const,
  activity: (id: string) => ['tasks', 'activity', id] as const,
  subtasks: (id: string) => ['tasks', 'subtasks', id] as const,
};

const PAGE_SIZE = 100;

export const useTaskList = (scope: { projectKey?: string }, filters: FilterValues) =>
  useInfiniteQuery({
    queryKey: taskKeys.list(scope.projectKey ?? 'me', filters),
    queryFn: ({ pageParam }) =>
      api<Page<TaskCard>>(scope.projectKey ? `/projects/${scope.projectKey}/tasks` : '/me/tasks', {
        query: { ...filters, limit: PAGE_SIZE, offset: pageParam },
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
    placeholderData: keepPreviousData,
  });

export const useBoard = (projectKey: string, workflow: Workflow, filters: FilterValues) =>
  useQuery({
    queryKey: taskKeys.board(projectKey, workflow, filters),
    queryFn: () =>
      api<{ columns: BoardColumn[] }>(`/projects/${projectKey}/board`, {
        query: { ...filters, workflow },
      }).then((data) => data.columns),
    placeholderData: keepPreviousData,
  });

export const fetchBoardColumn = (
  projectKey: string,
  workflow: Workflow,
  filters: FilterValues,
  statusId: string,
  offset: number,
) =>
  api<{ columns: BoardColumn[] }>(`/projects/${projectKey}/board`, {
    query: { ...filters, workflow, statusId, offset },
  }).then((data) => data.columns[0]!);

export const useTask = (id: string | null | undefined) =>
  useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => api<{ task: TaskDetail }>(`/tasks/${id}`).then((data) => data.task),
    enabled: !!id,
  });

export const useTaskByIdentifier = (identifier: string | null | undefined) => {
  const client = useQueryClient();
  return useQuery({
    queryKey: taskKeys.identifier(identifier ?? ''),
    queryFn: async () => {
      const { task } = await api<{ task: TaskDetail }>(`/tasks/by-identifier/${identifier}`);
      client.setQueryData(taskKeys.detail(task.id), task);
      return task;
    },
    enabled: !!identifier,
  });
};

export const useTaskActivity = (id: string) =>
  useQuery({
    queryKey: taskKeys.activity(id),
    queryFn: () => api<{ activity: ActivityEntry[] }>(`/tasks/${id}/activity`).then((data) => data.activity),
  });

export const useSubtasks = (id: string, enabled = true) =>
  useQuery({
    queryKey: taskKeys.subtasks(id),
    queryFn: () => api<{ tasks: TaskCard[] }>(`/tasks/${id}/subtasks`).then((data) => data.tasks),
    enabled,
  });

const patchCards = (client: QueryClient, patch: (task: TaskCard) => TaskCard) => {
  client.setQueriesData<{ pages: Page<TaskCard>[]; pageParams: unknown[] }>(
    { queryKey: taskKeys.lists },
    (data) =>
      data && { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(patch) })) },
  );
  client.setQueriesData<BoardColumn[]>({ queryKey: taskKeys.boards }, (columns) =>
    columns?.map((column) => {
      const tasks = column.tasks.map(patch);
      const kept = tasks.filter((task) => task.statusId === column.statusId);
      const arrived = columns
        .flatMap((other) => other.tasks.map(patch))
        .filter((task) => task.statusId === column.statusId && !kept.some((item) => item.id === task.id));
      const next = [...kept, ...arrived].sort((a, b) =>
        a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
      );
      return { ...column, tasks: next, total: column.total + (next.length - column.tasks.length) };
    }),
  );
};

export const invalidateTaskData = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: taskKeys.all }),
    client.invalidateQueries({ queryKey: projectKeys.all }),
  ]);

export const useCreateTask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ...input }: CreateTaskInput & { projectKey: string }) =>
      api<{ task: TaskDetail }>(`/projects/${projectKey}/tasks`, { method: 'POST', body: input }).then(
        (data) => data.task,
      ),
    onSuccess: (task) => {
      client.setQueryData(taskKeys.detail(task.id), task);
      return invalidateTaskData(client);
    },
  });
};

export const useUpdateTask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput; optimistic?: Partial<TaskCard> }) =>
      api<{ task: TaskDetail }>(`/tasks/${id}`, { method: 'PATCH', body: patch }).then((data) => data.task),
    onMutate: async ({ id, optimistic }) => {
      if (!optimistic) return;
      await client.cancelQueries({ queryKey: taskKeys.all });
      patchCards(client, (task) => (task.id === id ? { ...task, ...optimistic } : task));
      client.setQueryData<TaskDetail>(taskKeys.detail(id), (task) => task && { ...task, ...optimistic });
    },
    onSuccess: (task) => {
      client.setQueryData(taskKeys.detail(task.id), task);
      patchCards(client, (card) => (card.id === task.id ? { ...card, ...task } : card));
    },
    onSettled: () => invalidateTaskData(client),
  });
};

const useTaskAction = <TInput>(request: (input: TInput) => Promise<TaskDetail | void>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (task) => {
      if (task) client.setQueryData(taskKeys.detail(task.id), task);
      return invalidateTaskData(client);
    },
  });
};

export const useDeleteTask = () => useTaskAction((id: string) => api(`/tasks/${id}`, { method: 'DELETE' }));

export const useDuplicateTask = () =>
  useTaskAction((id: string) =>
    api<{ task: TaskDetail }>(`/tasks/${id}/duplicate`, { method: 'POST' }).then((data) => data.task),
  );

export const useReopenTask = () =>
  useTaskAction((id: string) =>
    api<{ task: TaskDetail }>(`/tasks/${id}/reopen`, { method: 'POST' }).then((data) => data.task),
  );

export const useMoveTask = () =>
  useTaskAction(({ id, projectKey }: { id: string; projectKey: string }) =>
    api<{ task: TaskDetail }>(`/tasks/${id}/move`, { method: 'POST', body: { projectKey } }).then(
      (data) => data.task,
    ),
  );

export const useBulkUpdate = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; patch: BulkPatch }) =>
      api<{ tasks: TaskCard[] }>(`/projects/${projectKey}/tasks/bulk`, { method: 'PATCH', body: input }).then(
        (data) => data.tasks,
      ),
    onSettled: () => invalidateTaskData(client),
  });
};

export const useBulkDelete = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api(`/projects/${projectKey}/tasks/bulk-delete`, { method: 'POST', body: { ids } }),
    onSettled: () => invalidateTaskData(client),
  });
};
