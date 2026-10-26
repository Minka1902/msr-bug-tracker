import { formatIdentifier } from '@msr/shared/identifiers';
import type { TaskFilters } from '@msr/shared/schemas/task';
import { query } from '../../db/pool';
import { buildTaskFilter, type FilterContext } from '../tasks/filters';
import { TASK_FROM } from '../tasks/queries';
import type { ExportColumn } from './spreadsheet';

interface ExportRow {
  number: number;
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  severity: string | null;
  assignee: string | null;
  assignee_email: string | null;
  reporter: string | null;
  labels: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: Date;
  completed_at: Date | null;
  parent_number: number | null;
  description: string;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
}

const BATCH = 1000;

export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Identifier', width: 12 },
  { header: 'Title', width: 42 },
  { header: 'Type', width: 12 },
  { header: 'Status', width: 16 },
  { header: 'Priority', width: 10 },
  { header: 'Severity', width: 10 },
  { header: 'Assignee', width: 22 },
  { header: 'Assignee email', width: 28 },
  { header: 'Reporter', width: 22 },
  { header: 'Labels', width: 24 },
  { header: 'Start date', width: 12 },
  { header: 'Due date', width: 12 },
  { header: 'Created', width: 20 },
  { header: 'Completed', width: 20 },
  { header: 'Parent', width: 12 },
  { header: 'Description', width: 60 },
  { header: 'Steps to reproduce', width: 32 },
  { header: 'Expected result', width: 26 },
  { header: 'Actual result', width: 26 },
];

const EXPORT_SELECT = `
  SELECT t.number, p.key::text AS key, t.title, t.type, s.name AS status, t.priority, t.severity,
         a.name AS assignee, a.email AS assignee_email, r.name AS reporter,
         (SELECT string_agg(l.name, ', ' ORDER BY lower(l.name))
          FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = t.id) AS labels,
         t.start_date::text, t.due_date::text, t.created_at, t.completed_at, pt.number AS parent_number,
         t.description, t.steps_to_reproduce, t.expected_behavior, t.actual_behavior
  ${TASK_FROM}
  LEFT JOIN users r ON r.id = t.reporter_id
  LEFT JOIN tasks pt ON pt.id = t.parent_id`;

const toValues = (row: ExportRow) => [
  formatIdentifier(row.key, row.number),
  row.title,
  row.type,
  row.status,
  row.priority,
  row.severity ?? '',
  row.assignee ?? '',
  row.assignee_email ?? '',
  row.reporter ?? '',
  row.labels ?? '',
  row.start_date ?? '',
  row.due_date ?? '',
  row.created_at.toISOString(),
  row.completed_at?.toISOString() ?? '',
  row.parent_number === null ? '' : formatIdentifier(row.key, row.parent_number),
  row.description,
  row.steps_to_reproduce,
  row.expected_behavior,
  row.actual_behavior,
];

export async function* exportBatches(projectId: string, filters: TaskFilters, context: FilterContext) {
  let after = 0;
  while (true) {
    const values: unknown[] = [projectId];
    const conditions = ['t.project_id = $1', ...buildTaskFilter(filters, context, values)];
    conditions.push(`t.number > $${values.push(after)}`);
    const rows = await query<ExportRow>(
      `${EXPORT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.number LIMIT $${values.push(BATCH)}`,
      values,
    );
    if (!rows.length) return;
    yield rows.map(toValues);
    if (rows.length < BATCH) return;
    after = rows.at(-1)!.number;
  }
}
