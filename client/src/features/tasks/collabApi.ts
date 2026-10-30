import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RelationType } from '@msr/shared/enums';
import type { Attachment, ChecklistItem, Comment, TaskRelation } from '@msr/shared/types';
import { api } from '../../lib/api';
import { invalidateTaskData, taskKeys } from './api';

const keys = {
  attachments: (taskId: string) => ['tasks', 'attachments', taskId] as const,
  comments: (taskId: string) => ['tasks', 'comments', taskId] as const,
  checklist: (taskId: string) => ['tasks', 'checklist', taskId] as const,
  relations: (taskId: string) => ['tasks', 'relations', taskId] as const,
};

export const uploadFiles = (files: File[], taskId?: string) => {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return api<{ attachments: Attachment[] }>(taskId ? `/tasks/${taskId}/attachments` : '/attachments', {
    method: 'POST',
    body: form,
  }).then((data) => data.attachments);
};

const useTaskMutation = <TInput, TResult>(taskId: string, request: (input: TInput) => Promise<TResult>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSettled: () =>
      Promise.all([
        invalidateTaskData(client),
        client.invalidateQueries({ queryKey: taskKeys.activity(taskId) }),
      ]),
  });
};

export const useAttachments = (taskId: string) =>
  useQuery({
    queryKey: keys.attachments(taskId),
    queryFn: () =>
      api<{ attachments: Attachment[] }>(`/tasks/${taskId}/attachments`).then((data) => data.attachments),
  });

export const useUploadAttachments = (taskId: string) =>
  useTaskMutation(taskId, (files: File[]) => uploadFiles(files, taskId));

export const useDeleteAttachment = (taskId: string) =>
  useTaskMutation(taskId, (id: string) => api(`/attachments/${id}`, { method: 'DELETE' }));

export const useComments = (taskId: string) =>
  useQuery({
    queryKey: keys.comments(taskId),
    queryFn: () => api<{ comments: Comment[] }>(`/tasks/${taskId}/comments`).then((data) => data.comments),
  });

export const useCreateComment = (taskId: string) =>
  useTaskMutation(taskId, (input: { body: string; parentId?: string | null; attachmentIds?: string[] }) =>
    api<{ comment: Comment }>(`/tasks/${taskId}/comments`, { method: 'POST', body: input }),
  );

export const useUpdateComment = (taskId: string) =>
  useTaskMutation(taskId, ({ id, ...input }: { id: string; body: string; attachmentIds: string[] }) =>
    api(`/comments/${id}`, { method: 'PATCH', body: input }),
  );

export const useDeleteComment = (taskId: string) =>
  useTaskMutation(taskId, (id: string) => api(`/comments/${id}`, { method: 'DELETE' }));

export const useChecklist = (taskId: string) =>
  useQuery({
    queryKey: keys.checklist(taskId),
    queryFn: () => api<{ items: ChecklistItem[] }>(`/tasks/${taskId}/checklist`).then((data) => data.items),
  });

export const useCreateChecklistItem = (taskId: string) =>
  useTaskMutation(taskId, (text: string) =>
    api(`/tasks/${taskId}/checklist`, { method: 'POST', body: { text } }),
  );

export const useUpdateChecklistItem = (taskId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; text?: string; isDone?: boolean; position?: string }) =>
      api(`/checklist/${id}`, { method: 'PATCH', body: input }),
    onMutate: ({ id, ...input }) =>
      client.setQueryData<ChecklistItem[]>(keys.checklist(taskId), (items) =>
        items
          ?.map((item) => (item.id === id ? { ...item, ...input } : item))
          .sort((a, b) => (a.position < b.position ? -1 : 1)),
      ),
    onSettled: () => invalidateTaskData(client),
  });
};

export const useDeleteChecklistItem = (taskId: string) =>
  useTaskMutation(taskId, (id: string) => api(`/checklist/${id}`, { method: 'DELETE' }));

export const useRelations = (taskId: string) =>
  useQuery({
    queryKey: keys.relations(taskId),
    queryFn: () =>
      api<{ relations: TaskRelation[] }>(`/tasks/${taskId}/relations`).then((data) => data.relations),
  });

export const useCreateRelation = (taskId: string) =>
  useTaskMutation(taskId, (input: { target: string; type: RelationType }) =>
    api(`/tasks/${taskId}/relations`, { method: 'POST', body: input }),
  );

export const useDeleteRelation = (taskId: string) =>
  useTaskMutation(taskId, (id: string) => api(`/relations/${id}`, { method: 'DELETE' }));
