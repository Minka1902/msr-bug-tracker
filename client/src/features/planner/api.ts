import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IdeaInput,
  PlanAnswer,
  PlanDraft,
  PlanQuestion,
  PlanRequest,
} from '@msr/shared/schemas/planner';
import { api } from '../../lib/api';
import { projectKeys } from '../projects/api';
import { taskKeys } from '../tasks/api';

export const useAskQuestions = () =>
  useMutation({
    mutationFn: (idea: IdeaInput) =>
      api<{ questions: PlanQuestion[] }>('/planner/questions', { method: 'POST', body: idea }).then(
        (data) => data.questions,
      ),
  });

export const useDraftPlan = () =>
  useMutation({
    mutationFn: (request: PlanRequest) => api<PlanDraft>('/planner/plan', { method: 'POST', body: request }),
  });

export const useCommitPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ...body }: PlanDraft & { projectKey: string; agentId: string | null }) =>
      api<{ created: number; warnings: string[] }>(`/projects/${projectKey}/plan`, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
};

export const useHandoffPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ...body }: { projectKey: string; agentId: string; answers: PlanAnswer[] }) =>
      api<{ task: { id: string; identifier: string } }>(`/projects/${projectKey}/plan/handoff`, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: projectKeys.all }),
        client.invalidateQueries({ queryKey: taskKeys.all }),
      ]),
  });
};
