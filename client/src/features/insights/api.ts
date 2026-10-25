import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Severity, TaskType } from '@msr/shared/enums';
import type { ActivityEntry, Page, ProjectSummary, TaskCard } from '@msr/shared/types';
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

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api<SearchResults>('/search', { query: { q }, signal }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
