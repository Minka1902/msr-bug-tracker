import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Severity, TaskType } from '@msr/shared/enums';
import type { ActivityEntry, ConclusionsPage, Page, ProjectSummary, TaskCard } from '@msr/shared/types';
import { api } from '../../lib/api';

export interface Dashboard {
  totals: { total: number; completed: number; incomplete: number; inProgress: number; overdue: number };
  completedTrend: number[];
  createdTrend: number[];
  bugsBySeverity: Partial<Record<Severity, number>>;
  projects: ProjectSummary[];
  recentTasks: TaskCard[];
  highPriorityBugs: TaskCard[];
  upcoming: TaskCard[];
  activity: ActivityEntry[];
}

export interface ProjectOverview {
  stats: ProjectSummary['stats'];
  byStatus: { statusId: string; count: number }[];
  byType: Partial<Record<TaskType, number>>;
  byPriority: Record<string, number>;
  completedTrend: number[];
  highPriorityBugs: TaskCard[];
  upcoming: TaskCard[];
  activity: ActivityEntry[];
}

export interface SearchResults {
  projects: Pick<ProjectSummary, 'key' | 'name' | 'color' | 'icon'>[];
  tasks: TaskCard[];
}

const ACTIVITY_PAGE = 50;
const CONCLUSIONS_PAGE = 30;

export const useDashboard = () =>
  useQuery({ queryKey: ['tasks', 'dashboard'], queryFn: () => api<Dashboard>('/dashboard') });

export const useProjectOverview = (key: string) =>
  useQuery({
    queryKey: ['tasks', 'overview', key.toUpperCase()],
    queryFn: () => api<ProjectOverview>(`/projects/${key}/overview`),
  });

export const useProjectActivity = (key: string) =>
  useInfiniteQuery({
    queryKey: ['tasks', 'project-activity', key.toUpperCase()],
    queryFn: ({ pageParam }) =>
      api<Page<ActivityEntry>>(`/projects/${key}/activity`, {
        query: { before: pageParam, limit: ACTIVITY_PAGE },
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
  });

export const useConclusions = (key: string, q: string) =>
  useInfiniteQuery({
    queryKey: ['tasks', 'conclusions', key.toUpperCase(), q],
    queryFn: ({ pageParam, signal }) =>
      api<ConclusionsPage>(`/projects/${key}/conclusions`, {
        query: { q, limit: CONCLUSIONS_PAGE, ...pageParam },
        signal,
      }),
    initialPageParam: undefined as { before: string; beforeId: string } | undefined,
    getNextPageParam: (last) => {
      const end = last.items.at(-1);
      return last.hasMore && end?.completedAt ? { before: end.completedAt, beforeId: end.id } : undefined;
    },
    placeholderData: keepPreviousData,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api<SearchResults>('/search', { query: { q }, signal }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
