import type { StatusCategory } from '@msr/shared/enums';
import type { z } from 'zod';
import type { NormalizedTask } from '../importer/types';

export interface SourceOption {
  id: string;
  name: string;
  group: string | null;
}

export interface FetchOptions {
  includeComments: boolean;
  includeClosed: boolean;
}

export type Progress = (message: string, done: number, total: number | null) => void;

export interface FetchedSource {
  name: string;
  tasks: NormalizedTask[];
  statusCategories: Record<string, StatusCategory>;
}

export interface MigrationAdapter<C> {
  label: string;
  credentials: z.ZodType<C>;
  listSources: (credentials: C) => Promise<SourceOption[]>;
  fetchSource: (
    credentials: C,
    sourceId: string,
    options: FetchOptions,
    progress: Progress,
  ) => Promise<FetchedSource>;
}
