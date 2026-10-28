import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IdeaInput, PlanQuestion, PlanRequest, PlanTask } from '@msr/shared/schemas/planner';
import { api } from '../../lib/api';
import { projectKeys } from '../projects/api';

export const useAskQuestions = () =>
  useMutation({
    mutationFn: (idea: IdeaInput) =>
      api<{ questions: PlanQuestion[] }>('/planner/questions', { method: 'POST', body: idea }).then(
        (data) => data.questions,
      ),
  });

export const useDraftPlan = () =>
  useMutation({
    mutationFn: (request: PlanRequest) =>
      api<{ tasks: PlanTask[] }>('/planner/plan', { method: 'POST', body: request }).then(
        (data) => data.tasks,
      ),
  });

export const useCommitPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectKey,
      ...body
    }: {
      projectKey: string;
      tasks: PlanTask[];
      agentId: string | null;
    }) =>
      api<{ created: number; warnings: string[] }>(`/projects/${projectKey}/plan`, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
};
