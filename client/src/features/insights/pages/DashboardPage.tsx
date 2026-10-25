import { format } from 'date-fns';
import {
  AlertTriangle,
  Bug,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  FolderPlus,
  History,
  ListTodo,
  Plus,
  Timer,
} from 'lucide-react';
import { Link } from 'react-router';
import { SEVERITIES, SEVERITY_META } from '@msr/shared/enums';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { MiniBarChart } from '../../../components/ui/MiniBarChart';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useShell } from '../../../hooks/useShell';
import { StatCard } from '../../dashboard/components/StatCard';
import { ActivityItem } from '../../tasks/components/ActivityItem';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useDashboard } from '../api';
import { ProjectProgressRow } from '../components/ProjectProgressRow';
import { SectionCard } from '../components/SectionCard';
import { TaskLine } from '../components/TaskLine';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function DashboardPage() {
  const open = (task: { identifier: string }) => peek.open(task.identifier);

  const user = useCurrentUser();
  const peek = useTaskPeek();
  const { openQuickCreate, openCreateProject } = useShell();
  const dashboard = useDashboard();
  const data = dashboard.data;

  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={format(new Date(), 'EEEE, MMMM d')}
        actions={
          <>
            <Button variant="secondary" leftIcon={<FolderPlus />} onClick={openCreateProject}>
              New project
            </Button>
            <Button leftIcon={<Plus />} onClick={() => openQuickCreate()}>
              New task
            </Button>
          </>
        }
      />
      {!data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-card" count={4} />
        </div>
      ) : data.projects.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<FolderKanban />}
            title="Welcome to MSR Tracker"
            description="Create your first project to start tracking tasks and bugs — or generate demo data from Settings to explore."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button leftIcon={<Plus />} onClick={openCreateProject}>
                  Create a project
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/settings/demo">Generate demo data</Link>
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Open"
                value={data.totals.incomplete}
                hint={`${sum(data.createdTrend)} created in 14 days`}
                icon={<ListTodo />}
                trend={data.createdTrend}
              />
              <StatCard
                label="Completed"
                value={data.totals.completed}
                hint={`${data.totals.total ? Math.round((data.totals.completed / data.totals.total) * 100) : 0}% of all tasks`}
                icon={<CheckCircle2 />}
                tone="success"
                trend={data.completedTrend}
              />
              <StatCard
                label="In progress"
                value={data.totals.inProgress}
                hint={`Across ${data.projects.length} projects`}
                icon={<Timer />}
                tone="info"
              />
              <StatCard
                label="Overdue"
                value={data.totals.overdue}
                hint={data.totals.overdue ? 'Needs attention' : 'All on schedule'}
                icon={<AlertTriangle />}
                tone="danger"
              />
            </div>
            <SectionCard
              title="Projects"
              icon={<FolderKanban />}
              action={
                <Button asChild size="xs" variant="ghost">
                  <Link to="/projects">View all</Link>
                </Button>
              }
            >
              <div className="grid gap-1 lg:grid-cols-2 lg:gap-x-4">
                {data.projects.slice(0, 8).map((project) => (
                  <ProjectProgressRow key={project.id} project={project} />
                ))}
              </div>
            </SectionCard>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="High-priority bugs" icon={<Bug />}>
                {data.highPriorityBugs.length ? (
                  data.highPriorityBugs.map((task) => <TaskLine key={task.id} task={task} onOpen={open} />)
                ) : (
                  <EmptyState
                    compact
                    icon={<CheckCircle2 />}
                    title="No urgent bugs"
                    description="Nothing critical is waiting."
                  />
                )}
              </SectionCard>
              <SectionCard title="Recently updated" icon={<History />}>
                {data.recentTasks.map((task) => (
                  <TaskLine key={task.id} task={task} onOpen={open} />
                ))}
              </SectionCard>
            </div>
          </div>
          <aside className="flex flex-col gap-5">
            <SectionCard
              title="Upcoming deadlines"
              icon={<CalendarClock />}
              action={<span className="text-xs text-muted">Next 7 days</span>}
            >
              {data.upcoming.length ? (
                data.upcoming.map((task) => (
                  <TaskLine key={task.id} task={task} onOpen={open} showAssignee={false} />
                ))
              ) : (
                <EmptyState compact icon={<CalendarClock />} title="Nothing due this week" />
              )}
            </SectionCard>
            <Card variant="inverted" className="flex flex-col gap-3">
              <p className="text-sm opacity-70">Open bugs by severity</p>
              <p className="font-display text-3xl font-bold">
                {sum(Object.values(data.bugsBySeverity))} open
              </p>
              <MiniBarChart
                data={SEVERITIES.map((severity) => ({
                  label: SEVERITY_META[severity].label,
                  value: data.bugsBySeverity[severity] ?? 0,
                  color: `var(--tone-${SEVERITY_META[severity].tone})`,
                }))}
              />
            </Card>
            <SectionCard title="Recent activity" icon={<History />}>
              <div className="flex flex-col gap-3">
                {data.activity.length ? (
                  data.activity.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => entry.task?.id && peek.open(entry.task.identifier)}
                      className="cursor-pointer text-left"
                    >
                      <ActivityItem entry={entry} showTask />
                    </button>
                  ))
                ) : (
                  <EmptyState compact icon={<History />} title="No activity yet" />
                )}
              </div>
            </SectionCard>
          </aside>
        </div>
      )}
    </div>
  );
}
