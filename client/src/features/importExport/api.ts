import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toSearch } from '../../lib/api';
import type { FilterValues } from '../../hooks/useUrlFilters';
import { projectKeys } from '../projects/api';
import { taskKeys } from '../tasks/api';

export type SheetFormat = 'csv' | 'xlsx';
export type ImportField =
  | 'title'
  | 'type'
  | 'status'
  | 'priority'
  | 'severity'
  | 'assignee'
  | 'labels'
  | 'startDate'
  | 'dueDate'
  | 'description'
  | 'stepsToReproduce'
  | 'expectedBehavior'
  | 'actualBehavior'
  | 'externalId'
  | 'parentExternalId'
  | 'createdAt';

export interface ImportPreview {
  headers: string[];
  mapping: Record<string, ImportField | null>;
  missingTitle: boolean;
  total: number;
  valid: number;
  skipped: { row: number; message: string }[];
  warnings: string[];
  sample: {
    row: number;
    title: string;
    type: string;
    status: string;
    priority: string;
    assignee: string | null;
    labels: string[];
    dueDate: string | null;
  }[];
}

export interface ImportResult {
  created: number;
  skipped: { row: number; message: string }[];
  warnings: string[];
}

interface ImportInput {
  file: File;
  mapping?: Record<string, ImportField | null>;
}

const send = <T>(projectKey: string, mode: 'preview' | 'commit', { file, mapping }: ImportInput) => {
  const form = new FormData();
  form.append('mode', mode);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  form.append('file', file);
  return api<T>(`/projects/${projectKey}/tasks/import`, { method: 'POST', body: form });
};

export const templateUrl = (format: SheetFormat) => `/api/import/template${toSearch({ format })}`;

export const exportUrl = (projectKey: string, format: SheetFormat, filters: FilterValues) =>
  `/api/projects/${projectKey}/tasks/export${toSearch({ ...filters, format })}`;

export const usePreviewImport = (projectKey: string) =>
  useMutation({ mutationFn: (input: ImportInput) => send<ImportPreview>(projectKey, 'preview', input) });

export const useCommitImport = (projectKey: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportInput) => send<ImportResult>(projectKey, 'commit', input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: taskKeys.all }),
        client.invalidateQueries({ queryKey: projectKeys.all }),
      ]),
  });
};
