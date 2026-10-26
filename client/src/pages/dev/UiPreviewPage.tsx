import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Filter,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  Timer,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { DEFAULT_STATUSES, PRIORITY_META, PRIORITIES, TYPE_META, TASK_TYPES } from '@msr/shared/enums';
import type { ProjectSummary, TaskCard, UserRef } from '@msr/shared/types';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { MiniBarChart } from '../../components/ui/MiniBarChart';
import { OptionPicker } from '../../components/ui/OptionPicker';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Switch } from '../../components/ui/Switch';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../features/dashboard/components/StatCard';
import { ProjectCard } from '../../features/projects/components/ProjectCard';
import { TaskCardView } from '../../features/tasks/components/TaskCardView';
import { PriorityIcon, TypeIcon } from '../../features/tasks/taskMeta';

const PEOPLE: UserRef[] = ['Adham Haddad', 'Noa Levi', 'Jennifer Grey', 'Omar Said', 'Mia Chen'].map(
  (name, index) => ({
    id: `u${index}`,
    name,
    avatarUrl: null,
  }),
);

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const project = (
  key: string,
  name: string,
  color: string,
  icon: string,
  progress: number,
  overdue: number,
  extra: Partial<ProjectSummary> = {},
): ProjectSummary => ({
  id: key,
  key,
  kind: 'software',
  name,
  description: `Designing and shipping the ${name.toLowerCase()} with a focus on clarity and speed.`,
  color,
  icon,
  liveUrl: null,
  repoUrl: null,
  isFavorite: false,
  isArchived: false,
  isDemo: false,
  isOwner: true,
  roleName: 'Owner',
  permissions: 0,
  stats: { total: 40, completed: Math.round(progress * 0.4), active: 8, overdue, progress },
  members: PEOPLE.slice(0, 2 + (progress % 4)),
  memberCount: 5,
  nextDueDate: day(3),
  createdAt: day(-30),
  updatedAt: day(-1),
  lastActivityAt: day(0),
  ...extra,
});

const PROJECTS = [
  project('WEB', 'Website Redesign', '#4f56f0', 'globe', 72, 0, { isFavorite: true }),
  project('APP', 'Mobile App', '#ec4899', 'smartphone', 46, 3),
  project('PAY', 'Payments API', '#14b8a6', 'credit-card', 88, 0, { isDemo: true }),
  project('SDK', 'Payment SDK', '#f59e0b', 'wrench', 12, 1, { nextDueDate: day(-2) }),
  project('CAL', 'Focus Calendar', '#22c55e', 'target', 100, 0),
  project('EXP', 'Asset Explorer', '#8b5cf6', 'layers', 0, 0, {
    stats: { total: 0, completed: 0, active: 0, overdue: 0, progress: 0 },
  }),
];

const task = (
  number: number,
  title: string,
  statusIndex: number,
  extra: Partial<TaskCard> = {},
): TaskCard => ({
  id: `t${number}`,
  projectId: 'WEB',
  projectKey: 'WEB',
  number,
  identifier: `WEB-${number}`,
  parentId: null,
  parentIdentifier: null,
  type: 'task',
  title,
  statusId: `s${statusIndex}`,
  statusCategory: DEFAULT_STATUSES.task[statusIndex]!.category,
  priority: 'medium',
  severity: null,
  assignee: PEOPLE[number % PEOPLE.length]!,
  reporterId: null,
  labels: [],
  startDate: null,
  dueDate: day((number % 9) - 3),
  recurrence: null,
  isBlocked: false,
  position: 'a0',
  commentCount: number % 3,
  attachmentCount: number % 2,
  checklistTotal: 0,
  checklistDone: 0,
  subtaskTotal: 0,
  subtaskDone: 0,
  coverUrl: null,
  createdAt: day(-5),
  updatedAt: day(-1),
  completedAt: null,
  ...extra,
});

const LABELS = {
  design: { id: 'l1', name: 'design', color: '#d946ef' },
  frontend: { id: 'l2', name: 'frontend', color: '#3b82f6' },
  ios: { id: 'l3', name: 'ios', color: '#64748b' },
};

const TASKS = [
  task(101, 'Prepare user research questionnaire', 1, { priority: 'high', labels: [LABELS.design] }),
  task(102, 'Design system tokens for dark mode', 1, { checklistTotal: 5, checklistDone: 2 }),
  task(103, 'Competitors analysis', 2, {
    labels: [LABELS.design, LABELS.frontend],
    subtaskTotal: 3,
    subtaskDone: 1,
  }),
  task(104, 'Login crashes on Safari 17 when autofill is used', 2, {
    type: 'bug',
    priority: 'urgent',
    isBlocked: true,
    labels: [LABELS.ios],
  }),
  task(105, 'Create wireframes for onboarding flow', 3, { priority: 'low', commentCount: 4 }),
  task(106, 'Heuristic evaluation of checkout', 4, { priority: 'high' }),
];

const NOOP = () => undefined;

export function UiPreviewPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [priority, setPriority] = useState<string | null>('high');
  const [types, setTypes] = useState<string[]>(['bug']);
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(true);

  return (
    <AppShell
      user={{ name: 'Adham Haddad', email: 'adham@msr.dev' }}
      projects={PROJECTS}
      actions={{ onLogout: NOOP, onSearch: NOOP, onQuickCreate: NOOP, onCreateProject: NOOP, onInvite: NOOP }}
      banners={
        <Banner
          tone="warning"
          icon={<AlertTriangle />}
          action={
            <Button size="xs" variant="soft">
              Resend
            </Button>
          }
        >
          Verify your email to secure your account.
        </Banner>
      }
    >
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">Project Workspace</h1>
          <div className="flex-1" />
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
              { value: 'list', label: 'List', icon: <List /> },
            ]}
          />
          <Button leftIcon={<Plus />}>New Project</Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Open tasks"
            value={128}
            hint="↑ 12% this week"
            icon={<FolderKanban />}
            trend={[4, 6, 5, 8, 7, 9, 12, 10, 13]}
          />
          <StatCard
            label="Completed"
            value={342}
            hint="Last 14 days"
            icon={<CheckCircle2 />}
            tone="success"
            trend={[2, 3, 5, 4, 6, 7, 6, 9, 11]}
          />
          <StatCard
            label="In progress"
            value={27}
            hint="Across 6 projects"
            icon={<Timer />}
            tone="info"
            trend={[5, 4, 6, 6, 5, 7, 8, 7, 6]}
          />
          <StatCard
            label="Overdue"
            value={4}
            hint="Needs attention"
            icon={<AlertTriangle />}
            tone="danger"
            trend={[1, 2, 2, 3, 2, 4, 3, 5, 4]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROJECTS.map((item) => (
            <ProjectCard key={item.key} project={item} onToggleFavorite={NOOP} />
          ))}
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">Website Redesign</h2>
            <div className="flex-1" />
            <Button variant="ghost" leftIcon={<Filter />}>
              Filter
            </Button>
            <Button leftIcon={<Plus />}>Add task</Button>
          </div>
          <Tabs
            items={['Overview', 'Board', 'List', 'Bugs', 'Activity', 'Settings'].map((label) => ({
              value: label,
              label,
              count: label === 'Bugs' ? 4 : undefined,
            }))}
            defaultValue="Board"
          />
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin max-md:snap-x max-md:snap-mandatory">
            {DEFAULT_STATUSES.task.slice(1).map((status, index) => (
              <div
                key={status.name}
                className="flex w-72 shrink-0 flex-col gap-3 max-md:w-[82vw] max-md:snap-start"
              >
                <div
                  style={{ '--c': status.color } as CSSProperties}
                  className="flex items-center gap-2 border-b-[3px] border-(--c) pb-2"
                >
                  <span className="text-xs font-semibold tracking-wide uppercase tint">{status.name}</span>
                  <span className="text-xs text-subtle">
                    {TASKS.filter((item) => item.statusId === `s${index + 1}`).length}
                  </span>
                </div>
                {TASKS.filter((item) => item.statusId === `s${index + 1}`).map((item) => (
                  <TaskCardView key={item.id} task={item} />
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus />}
                  className="justify-start text-muted"
                >
                  Add task
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card variant="inverted" className="flex flex-col gap-3">
            <p className="text-sm opacity-70">Bugs by severity</p>
            <p className="font-display text-3xl font-bold">23 open</p>
            <MiniBarChart
              data={[
                { label: 'Critical', value: 3, color: 'var(--tone-danger)' },
                { label: 'Major', value: 9, color: 'var(--tone-warning)' },
                { label: 'Minor', value: 7, color: 'var(--tone-info)' },
                { label: 'Trivial', value: 4, color: 'var(--tone-neutral)' },
              ]}
            />
          </Card>
          <Card className="flex flex-col gap-3">
            <p className="font-semibold">Controls</p>
            <Input leftIcon={<Search />} placeholder="Search tasks…" />
            <div className="flex flex-wrap gap-2">
              <OptionPicker
                aria-label="Priority"
                value={priority}
                onChange={setPriority}
                clearable
                options={PRIORITIES.map((value) => ({
                  value,
                  label: PRIORITY_META[value].label,
                  icon: <PriorityIcon priority={value} decorative />,
                }))}
              />
              <OptionPicker
                multiple
                aria-label="Type"
                value={types}
                onChange={setTypes}
                options={TASK_TYPES.map((value) => ({
                  value,
                  label: TYPE_META[value].label,
                  icon: <TypeIcon type={value} />,
                }))}
              />
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              label="Can assign tasks"
              description="Assign tasks to any member"
            />
            <Checkbox checked={checked} onCheckedChange={setChecked} label="Show subtasks" />
          </Card>
          <Card className="flex flex-col gap-3">
            <p className="font-semibold">Buttons & badges</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="soft">
                Soft
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
              <Button size="sm" variant="danger">
                Delete
              </Button>
              <Button size="sm" loading>
                Saving
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((value) => (
                <Badge key={value} tone={PRIORITY_META[value].tone} label={PRIORITY_META[value].label} />
              ))}
              {DEFAULT_STATUSES.bug.map((status) => (
                <Badge key={status.name} variant="dot" color={status.color} label={status.name} />
              ))}
            </div>
            <EmptyState
              compact
              icon={<Bug />}
              title="No bugs here"
              description="Bugs you report will show up here."
            />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
