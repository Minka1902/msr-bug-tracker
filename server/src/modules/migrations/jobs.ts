import { randomUUID } from 'node:crypto';
import type { StatusCategory } from '@msr/shared/enums';
import { HttpError, notFound } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { commitImport, type ImportOptions } from '../importer/commit';
import { personKey } from '../importer/values';
import type { ProjectContext } from '../projects/access';
import type { FetchedSource, FetchOptions, MigrationAdapter } from './types';

type JobStatus = 'fetching' | 'ready' | 'importing' | 'done' | 'failed';

interface Job {
  id: string;
  userId: string;
  tool: string;
  status: JobStatus;
  progress: { message: string; done: number; total: number | null };
  error: string | null;
  source: FetchedSource | null;
  result: { projectKey: string; created: number; skipped: number; warnings: string[] } | null;
  touchedAt: number;
}

const JOB_TTL_MS = 2 * 60 * 60_000;
const jobs = new Map<string, Job>();

const purgeExpired = () => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) if (job.touchedAt < cutoff && job.status !== 'importing') jobs.delete(id);
};

const fail = (job: Job, error: unknown) => {
  job.status = 'failed';
  job.error = error instanceof HttpError ? error.message : 'Something went wrong while importing';
  if (!(error instanceof HttpError)) logger.error({ err: error, tool: job.tool }, 'Migration failed');
};

export const startJob = <C>(
  userId: string,
  tool: string,
  adapter: MigrationAdapter<C>,
  credentials: C,
  sourceId: string,
  options: FetchOptions,
) => {
  purgeExpired();
  const job: Job = {
    id: randomUUID(),
    userId,
    tool,
    status: 'fetching',
    progress: { message: `Connecting to ${adapter.label}`, done: 0, total: null },
    error: null,
    source: null,
    result: null,
    touchedAt: Date.now(),
  };
  jobs.set(job.id, job);
  adapter
    .fetchSource(credentials, sourceId, options, (message, done, total) => {
      job.progress = { message, done, total };
    })
    .then((source) => {
      job.source = source;
      job.status = 'ready';
      job.progress = { message: 'Ready to import', done: source.tasks.length, total: source.tasks.length };
    })
    .catch((error: unknown) => fail(job, error));
  return job;
};

export const getJob = (id: string, userId: string) => {
  const job = jobs.get(id);
  if (!job || job.userId !== userId) throw notFound('This import is no longer available. Start again.');
  job.touchedAt = Date.now();
  return job;
};

export const discardJob = (job: Job) => jobs.delete(job.id);

export const summarizeJob = (job: Job) => {
  const tasks = job.source?.tasks ?? [];
  const statuses = new Map<string, { name: string; category: StatusCategory; count: number }>();
  const people = new Map<string, { key: string; name: string | null; email: string | null; count: number }>();
  tasks.forEach((task) => {
    if (task.status) {
      const entry = statuses.get(task.status) ?? {
        name: task.status,
        category: job.source!.statusCategories[task.status] ?? task.statusCategory ?? 'todo',
        count: 0,
      };
      entry.count += 1;
      statuses.set(task.status, entry);
    }
    if (task.assignee) {
      const key = personKey(task.assignee);
      const entry = people.get(key) ?? { key, ...task.assignee, count: 0 };
      entry.count += 1;
      people.set(key, entry);
    }
  });
  return {
    id: job.id,
    tool: job.tool,
    status: job.status,
    progress: job.progress,
    error: job.error,
    sourceName: job.source?.name ?? null,
    total: tasks.length,
    statuses: [...statuses.values()],
    people: [...people.values()].sort((a, b) => b.count - a.count),
    result: job.result,
  };
};

export const commitJob = (
  job: Job,
  project: ProjectContext,
  options: Required<Pick<ImportOptions, 'statusMap' | 'memberMap'>>,
) => {
  if (job.status !== 'ready' || !job.source) throw new HttpError(409, 'This import is not ready yet');
  job.status = 'importing';
  job.progress = { message: 'Creating tasks', done: 0, total: job.source.tasks.length };
  commitImport(project, job.source.tasks, job.userId, {
    statusMap: Object.fromEntries(
      Object.entries(options.statusMap).map(([name, id]) => [name.toLowerCase(), id]),
    ),
    memberMap: options.memberMap,
    source: job.tool,
  })
    .then((result) => {
      job.status = 'done';
      job.source = null;
      job.result = {
        projectKey: project.key,
        created: result.created,
        skipped: result.skipped.length,
        warnings: result.warnings,
      };
      job.progress = { message: 'Done', done: result.created, total: result.created };
    })
    .catch((error: unknown) => fail(job, error));
};
