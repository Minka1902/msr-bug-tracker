import { FolderPlus, LayoutGrid, List, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ProjectSummary } from '@msr/shared/types';
import { PageHeader } from '../../../components/layout/PageHeader';
import { AvatarGroup } from '../../../components/ui/AvatarGroup';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataColumn, type SortState } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useLocalState } from '../../../hooks/useLocalState';
import { useShell } from '../../../hooks/useShell';
import { cn } from '../../../lib/cn';
import { formatRelative } from '../../../lib/dates';
import { useProjects, useToggleFavorite, type ArchivedFilter } from '../api';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectHealthBadge } from '../components/ProjectHealthBadge';

type Scope = 'all' | 'favorites' | 'owned' | 'shared';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'owned', label: 'Owned by me' },
  { value: 'shared', label: 'Shared with me' },
];

const SCOPE_FILTERS: Record<Scope, (project: ProjectSummary) => boolean> = {
  all: () => true,
  favorites: (project) => project.isFavorite,
  owned: (project) => project.isOwner,
  shared: (project) => !project.isOwner,
};

const SORTERS: Record<string, (a: ProjectSummary, b: ProjectSummary) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  progress: (a, b) => a.stats.progress - b.stats.progress,
  tasks: (a, b) => a.stats.total - b.stats.total,
  overdue: (a, b) => a.stats.overdue - b.stats.overdue,
  activity: (a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt),
};

const COLUMNS: DataColumn<ProjectSummary>[] = [
  {
    id: 'name',
    header: 'Project',
    width: 'minmax(260px, 2fr)',
    sortable: true,
    cell: (project) => (
      <span className="flex min-w-0 items-center gap-3">
        <ProjectAvatar color={project.color} icon={project.icon} size="sm" />
        <span className="truncate font-medium">{project.name}</span>
        <span className="font-mono text-xs text-subtle">{project.key}</span>
        {project.isFavorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
      </span>
    ),
  },
  {
    id: 'progress',
    header: 'Progress',
    width: '180px',
    sortable: true,
    cell: (project) => (
      <ProgressBar value={project.stats.progress} color={project.color} showValue className="w-full" />
    ),
  },
  {
    id: 'tasks',
    header: 'Done',
    width: '90px',
    sortable: true,
    align: 'end',
    cell: (project) => (
      <span className="tabular-nums">{`${project.stats.completed}/${project.stats.total}`}</span>
    ),
  },
  {
    id: 'overdue',
    header: 'Health',
    width: '120px',
    sortable: true,
    cell: (project) => <ProjectHealthBadge project={project} />,
  },
  {
    id: 'members',
    header: 'Team',
    width: '120px',
    cell: (project) => <AvatarGroup people={project.members} />,
  },
  {
    id: 'role',
    header: 'Role',
    width: '110px',
    cell: (project) => <span className="text-muted">{project.roleName}</span>,
  },
  {
    id: 'activity',
    header: 'Last activity',
    width: '140px',
    sortable: true,
    cell: (project) => <span className="text-muted">{formatRelative(project.lastActivityAt)}</span>,
  },
];

export function ProjectsPage() {
  const toggleFavorite = (project: ProjectSummary) =>
    favorite.mutate({ key: project.key, favorite: !project.isFavorite });

  const navigate = useNavigate();
  const { openCreateProject } = useShell();
  const favorite = useToggleFavorite();
  const [view, setView] = useLocalState<'grid' | 'list'>('msr-projects-view', 'grid');
  const [archived, setArchived] = useState<ArchivedFilter>('false');
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const projects = useProjects(archived);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (projects.data ?? []).filter(
      (project) =>
        SCOPE_FILTERS[scope](project) &&
        (!term || `${project.name} ${project.key} ${project.description}`.toLowerCase().includes(term)),
    );
    if (!sort) return filtered;
    const sorted = [...filtered].sort(SORTERS[sort.id]);
    return sort.desc ? sorted.reverse() : sorted;
  }, [projects.data, scope, search, sort]);

  const empty = (
    <EmptyState
      icon={<FolderPlus />}
      title={
        projects.data?.length
          ? 'No projects match'
          : archived === 'true'
            ? 'No archived projects'
            : 'Create your first project'
      }
      description={
        projects.data?.length
          ? 'Try another filter or search.'
          : 'Projects keep tasks, bugs and their workflow together.'
      }
      action={
        !projects.data?.length &&
        archived !== 'true' && (
          <Button leftIcon={<Plus />} onClick={openCreateProject}>
            New project
          </Button>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        title="Project Workspace"
        description="Every project you own or have been invited to."
        actions={
          <>
            <SegmentedControl
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
                { value: 'list', label: 'List', icon: <List /> },
              ]}
            />
            <Button leftIcon={<Plus />} onClick={openCreateProject}>
              New Project
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SCOPES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={scope === item.value}
              onClick={() => setScope(item.value)}
              className="h-8 cursor-pointer rounded-full border border-border bg-surface px-3.5 text-sm text-muted transition-colors hover:text-text aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-contrast"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <SegmentedControl
          size="sm"
          label="Status"
          value={archived}
          onChange={setArchived}
          options={[
            { value: 'false', label: 'Active' },
            { value: 'true', label: 'Archived' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leftIcon={<Search />}
          placeholder="Search projects"
          size="sm"
          wrapperClassName="w-full sm:w-60"
        />
      </div>
      {projects.error && <ErrorState error={projects.error} onRetry={projects.refetch} />}
      {view === 'grid' && !projects.error && (
        <div
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
            !projects.isPending && visible.length === 0 && 'block',
          )}
        >
          {projects.isPending && <Skeleton className="h-80 rounded-card" count={6} />}
          {!projects.isPending && visible.length === 0 && empty}
          {visible.map((project) => (
            <ProjectCard key={project.key} project={project} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
      {view === 'list' && !projects.error && (
        <DataTable
          label="Projects"
          rows={visible}
          columns={COLUMNS}
          getRowId={(project) => project.id}
          sort={sort}
          onSortChange={setSort}
          loading={projects.isPending}
          empty={empty}
          rowHeight={56}
          onRowClick={(project) => navigate(`/p/${project.key}`)}
          renderMobile={(project) => <ProjectCard project={project} onToggleFavorite={toggleFavorite} />}
        />
      )}
    </div>
  );
}
