import { CircleCheck, ListTodo } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar, type FilterDef } from '../../../components/ui/FilterBar';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useLocalState } from '../../../hooks/useLocalState';
import { useUrlFilters, type FilterValues } from '../../../hooks/useUrlFilters';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { useProjects } from '../../projects/api';
import { useTaskList } from '../../tasks/api';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useTaskOptions } from '../../tasks/useTaskOptions';
import { taskFilterDefs } from '../../tasks/taskFilterDefs';
import { groupMyTasks, type MyTasksGrouping } from '../groupMyTasks';
import { TaskLine } from '../components/TaskLine';

const DEFAULTS: FilterValues = { hideDone: 'true', sort: 'due', dir: 'asc' };
const NO_PROJECT = { statuses: [], labels: [], memberList: [] };
const KEPT_FILTERS = new Set(['priority', 'type', 'severity', 'dueFrom', 'overdue', 'blocked', 'hideDone']);

export function MyTasksPage() {
  const peek = useTaskPeek();
  const projects = useProjects();
  const options = useTaskOptions(NO_PROJECT);
  const { filters, update, clear } = useUrlFilters(DEFAULTS);
  const [grouping, setGrouping] = useLocalState<MyTasksGrouping>('msr-my-tasks-group', 'deadline');
  const list = useTaskList({}, filters);
  const tasks = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const groups = useMemo(
    () => groupMyTasks(tasks, grouping, projects.data ?? []),
    [tasks, grouping, projects.data],
  );
  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'project',
        label: 'Project',
        type: 'multi',
        options: (projects.data ?? []).map((project) => ({
          value: project.key,
          label: project.name,
          icon: <ProjectAvatar color={project.color} icon={project.icon} size="xs" />,
        })),
      },
      ...taskFilterDefs(options).filter((def) => KEPT_FILTERS.has(def.key)),
    ],
    [projects.data, options],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-6">
      <PageHeader
        title="My Tasks"
        description="Everything assigned to you, across all projects."
        actions={
          <SegmentedControl
            size="sm"
            label="Group by"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: 'deadline', label: 'Deadline' },
              { value: 'project', label: 'Project' },
              { value: 'priority', label: 'Priority' },
              { value: 'status', label: 'Status' },
            ]}
          />
        }
      />
      <FilterBar defs={defs} values={filters} onChange={update} onClear={clear} />
      {list.error && <ErrorState error={list.error} onRetry={list.refetch} />}
      {list.isPending && <Skeleton className="h-40 rounded-card" count={2} />}
      {!list.isPending && !groups.length && (
        <Card>
          <EmptyState
            icon={filters.hideDone === 'true' ? <CircleCheck /> : <ListTodo />}
            title="You're all caught up"
            description="Nothing assigned to you matches these filters."
          />
        </Card>
      )}
      {groups.map((group) => (
        <Card
          key={group.key}
          role="region"
          aria-label={group.label}
          padding="sm"
          className="flex flex-col gap-1"
        >
          <div
            style={{ '--c': group.tone ?? 'var(--tone-neutral)' } as CSSProperties}
            className="flex items-center gap-2 px-2 pt-1 pb-2"
          >
            <span className="size-2.5 rounded-full bg-(--c)" />
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <span className="text-xs text-subtle">{group.tasks.length}</span>
          </div>
          {group.tasks.map((task) => (
            <TaskLine
              key={task.id}
              task={task}
              onOpen={(item) => peek.open(item.identifier)}
              showAssignee={false}
              trailing={
                grouping !== 'project' && (
                  <span className="hidden text-xs text-subtle sm:inline">{task.projectKey}</span>
                )
              }
            />
          ))}
        </Card>
      ))}
      {list.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
