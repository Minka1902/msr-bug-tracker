import { Ban, GitBranch } from 'lucide-react';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import type { DataColumn } from '../../components/ui/DataTable';
import { formatRelative } from '../../lib/dates';
import { TaskPropertyPicker } from './components/TaskPropertyPicker';
import { TypeIcon } from './taskMeta';

export const SORT_BY_COLUMN: Record<string, string> = {
  identifier: 'number',
  title: 'title',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  dueDate: 'due',
  updated: 'updated',
};

export const COLUMN_BY_SORT = Object.fromEntries(
  Object.entries(SORT_BY_COLUMN).map(([column, sort]) => [sort, column]),
);

export const taskColumns = (project: ProjectDetail, { bugsOnly = false } = {}): DataColumn<TaskCard>[] => [
  {
    id: 'identifier',
    header: 'ID',
    width: '96px',
    sortable: true,
    cell: (task) => <span className="font-mono text-xs text-subtle">{task.identifier}</span>,
  },
  {
    id: 'title',
    header: 'Title',
    width: 'minmax(280px, 3fr)',
    sortable: true,
    cell: (task) => (
      <span className="flex min-w-0 items-center gap-2">
        <TypeIcon type={task.type} />
        <span
          className={`truncate font-medium ${task.statusCategory === 'done' ? 'text-muted line-through' : ''}`}
        >
          {task.title}
        </span>
        {task.isBlocked && <Ban className="size-3.5 shrink-0 text-danger" aria-label="Blocked" />}
        {task.subtaskTotal > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-subtle">
            <GitBranch className="size-3" />
            {task.subtaskDone}/{task.subtaskTotal}
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    width: '170px',
    sortable: true,
    cell: (task) => <TaskPropertyPicker task={task} field="status" project={project} />,
  },
  {
    id: 'priority',
    header: 'Priority',
    width: '130px',
    sortable: true,
    cell: (task) => <TaskPropertyPicker task={task} field="priority" project={project} />,
  },
  ...(bugsOnly
    ? [
        {
          id: 'severity',
          header: 'Severity',
          width: '130px',
          cell: (task: TaskCard) => <TaskPropertyPicker task={task} field="severity" project={project} />,
        },
      ]
    : []),
  {
    id: 'assignee',
    header: 'Assignee',
    width: '180px',
    sortable: true,
    cell: (task) => <TaskPropertyPicker task={task} field="assignee" project={project} />,
  },
  {
    id: 'labels',
    header: 'Labels',
    width: '190px',
    cell: (task) => <TaskPropertyPicker task={task} field="labels" project={project} />,
  },
  {
    id: 'dueDate',
    header: 'Due',
    width: '130px',
    sortable: true,
    cell: (task) => <TaskPropertyPicker task={task} field="dueDate" project={project} />,
  },
  {
    id: 'updated',
    header: 'Updated',
    width: '120px',
    sortable: true,
    cell: (task) => <span className="text-xs text-muted">{formatRelative(task.updatedAt)}</span>,
  },
];
