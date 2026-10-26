import {
  AlertTriangle,
  Bug,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  History,
  ListTodo,
  Shapes,
  Timer,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  PRIORITIES,
  PRIORITY_META,
  KIND_TASK_TYPES,
  TYPE_META,
  WORKFLOW_META,
  WORKFLOWS,
} from '@msr/shared/enums';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { MiniBarChart } from '../../../components/ui/MiniBarChart';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatCard } from '../../dashboard/components/StatCard';
import { useProjectContext } from '../../projects/useProjectContext';
import { ActivityItem } from '../../tasks/components/ActivityItem';
import { TypeIcon } from '../../tasks/taskMeta';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useProjectOverview } from '../api';
import { SectionCard } from '../components/SectionCard';
import { TaskLine } from '../components/TaskLine';

export function ProjectOverviewPage() {
  const open = (task: { identifier: string }) => peek.open(task.identifier);

  const project = useProjectContext();
  const peek = useTaskPeek();
  const overview = useProjectOverview(project.key);
  const data = overview.data;

  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (!data) return <Skeleton className="h-32 rounded-card" count={3} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={data.stats.total}
          hint={`${data.stats.progress}% complete`}
          icon={<ListTodo />}
        />
        <StatCard
          label="Completed"
          value={data.stats.completed}
          hint="Last 14 days"
          icon={<CheckCircle2 />}
          tone="success"
          trend={data.completedTrend}
        />
        <StatCard label="In progress" value={data.stats.active} icon={<Timer />} tone="info" />
        <StatCard
          label="Overdue"
          value={data.stats.overdue}
          hint={data.stats.overdue ? 'Needs attention' : 'On schedule'}
          icon={<AlertTriangle />}
          tone="danger"
        />
      </div>
      <SectionCard
        title="Progress"
        icon={<CircleDot />}
        action={<span className="text-sm font-semibold tabular-nums">{data.stats.progress}%</span>}
      >
        <ProgressBar
          value={data.stats.progress}
          color={project.color}
          size="md"
          aria-label="Project progress"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WORKFLOWS.map((workflow) => {
            const statuses = project.statuses.filter((status) => status.workflow === workflow);
            const counts = statuses.map(
              (status) => data.byStatus.find((row) => row.statusId === status.id)?.count ?? 0,
            );
            const total = counts.reduce((sum, count) => sum + count, 0);
            return (
              <div key={workflow} className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {WORKFLOW_META[workflow].label}
                </span>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  {statuses.map((status, index) => (
                    <div
                      key={status.id}
                      title={`${status.name}: ${counts[index]}`}
                      style={
                        {
                          width: `${total ? (counts[index]! / total) * 100 : 0}%`,
                          background: status.color,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {statuses.map((status, index) => (
                    <Badge
                      key={status.id}
                      variant="dot"
                      color={status.color}
                      label={`${status.name} ${counts[index]}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="By type" icon={<Shapes />}>
          <div className="flex flex-col gap-2">
            {KIND_TASK_TYPES[project.kind].map((type) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <TypeIcon type={type} />
                <span className="flex-1">{TYPE_META[type].label}</span>
                <span className="font-semibold tabular-nums">{data.byType[type] ?? 0}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Open work by priority" icon={<AlertTriangle />}>
          <MiniBarChart
            height={88}
            data={PRIORITIES.map((priority) => ({
              label: PRIORITY_META[priority].label,
              value: data.byPriority[priority] ?? 0,
              color: `var(--tone-${PRIORITY_META[priority].tone})`,
            }))}
          />
        </SectionCard>
        <SectionCard title="Upcoming deadlines" icon={<CalendarClock />}>
          {data.upcoming.length ? (
            data.upcoming.map((task) => (
              <TaskLine key={task.id} task={task} onOpen={open} showAssignee={false} />
            ))
          ) : (
            <EmptyState compact icon={<CalendarClock />} title="Nothing due this week" />
          )}
        </SectionCard>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="High-priority bugs" icon={<Bug />}>
          {data.highPriorityBugs.length ? (
            data.highPriorityBugs.map((task) => <TaskLine key={task.id} task={task} onOpen={open} />)
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="No urgent bugs" />
          )}
        </SectionCard>
        <SectionCard title="Recent activity" icon={<History />}>
          <div className="flex flex-col gap-3">
            {data.activity.length ? (
              data.activity.map((entry) => <ActivityItem key={entry.id} entry={entry} showTask />)
            ) : (
              <EmptyState compact icon={<History />} title="No activity yet" />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
