import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectDetail, TaskCard } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useShell } from '../../../hooks/useShell';
import { useUrlFilters, type FilterValues } from '../../../hooks/useUrlFilters';
import { ImportExportMenu } from '../../importExport/components/ImportExportMenu';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { useTaskList } from '../api';
import { COLUMN_BY_SORT, SORT_BY_COLUMN, taskColumns } from '../taskColumns';
import { taskFilterDefs } from '../taskFilterDefs';
import { useTaskOptions } from '../useTaskOptions';
import { useTaskPeek } from '../useTaskPeek';
import { BulkActionBar } from './BulkActionBar';
import { TaskRowCard } from './TaskRowCard';

interface TaskListViewProps {
  project: ProjectDetail;
  bugsOnly?: boolean;
  onOpen: (task: TaskCard) => void;
}

const DEFAULTS: FilterValues = { sort: 'updated', dir: 'desc' };

export function TaskListView({ project, bugsOnly = false, onOpen }: TaskListViewProps) {
  const clearAll = () => {
    setSearch('');
    clear();
  };

  const { filters, update, clear } = useUrlFilters(DEFAULTS);
  const { openQuickCreate } = useShell();
  const peek = useTaskPeek();
  const permissions = useProjectPermissions(project);
  const options = useTaskOptions(project);
  const [search, setSearch] = useState(filters.q ?? '');
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const debouncedSearch = useDebouncedValue(search, 250);
  const query = useMemo(() => ({ ...filters, ...(bugsOnly && { type: 'bug' }) }), [filters, bugsOnly]);
  const list = useTaskList({ projectKey: project.key }, query);
  const tasks = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const columns = useMemo(() => taskColumns(project, { bugsOnly }), [project, bugsOnly]);
  const defs = useMemo(() => taskFilterDefs(options, { bugsOnly }), [options, bugsOnly]);
  const selected = tasks.filter((task) => selectedIds.has(task.id));

  useEffect(() => {
    if ((filters.q ?? '') !== debouncedSearch) update({ q: debouncedSearch });
  }, [debouncedSearch, filters.q, update]);

  if (list.error) return <ErrorState error={list.error} onRetry={list.refetch} />;

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        defs={defs}
        values={filters}
        onChange={update}
        onClear={clearAll}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: bugsOnly ? 'Search bugs' : 'Search tasks',
        }}
      >
        <ImportExportMenu project={project} filters={query} canImport={permissions.can('task.create')} />
      </FilterBar>
      <DataTable
        label={bugsOnly ? 'Bugs' : 'Tasks'}
        rows={tasks}
        columns={columns}
        getRowId={(task) => task.id}
        getRowLabel={(task) => `${task.identifier} ${task.title}`}
        loading={list.isPending}
        activeRowId={tasks.find((task) => task.identifier === peek.identifier)?.id}
        onRowClick={onOpen}
        selected={selectedIds}
        onSelectedChange={setSelectedIds}
        sort={
          filters.sort ? { id: COLUMN_BY_SORT[filters.sort] ?? 'updated', desc: filters.dir !== 'asc' } : null
        }
        onSortChange={(sort) =>
          update({
            sort: sort ? SORT_BY_COLUMN[sort.id]! : 'updated',
            dir: sort ? (sort.desc ? 'desc' : 'asc') : 'desc',
          })
        }
        renderMobile={(task) => (
          <TaskRowCard
            task={task}
            status={project.statuses.find((status) => status.id === task.statusId)}
            onOpen={onOpen}
          />
        )}
        empty={
          <EmptyState
            icon={<ListTodo />}
            title={
              Object.keys(filters).length > 2
                ? 'Nothing matches these filters'
                : bugsOnly
                  ? 'No bugs reported'
                  : 'No tasks yet'
            }
            action={
              permissions.can('task.create') && (
                <Button
                  leftIcon={<Plus />}
                  onClick={() =>
                    openQuickCreate({ projectKey: project.key, type: bugsOnly ? 'bug' : undefined })
                  }
                >
                  {bugsOnly ? 'Report a bug' : 'Add task'}
                </Button>
              )
            }
          />
        }
        footer={
          list.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              loading={list.isFetchingNextPage}
              onClick={() => list.fetchNextPage()}
            >
              Load more
            </Button>
          )
        }
      />
      <BulkActionBar project={project} selected={selected} onClear={() => setSelectedIds(new Set())} />
    </div>
  );
}
