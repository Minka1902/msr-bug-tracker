import {
  Archive,
  Bug,
  CalendarDays,
  ChartPie,
  History,
  House,
  KanbanSquare,
  List,
  Plus,
  Settings,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { Outlet, useParams } from 'react-router';
import { can } from '@msr/shared/permissions';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { IconButton } from '../../../components/ui/IconButton';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TabLinks } from '../../../components/ui/TabLinks';
import { useShell } from '../../../hooks/useShell';
import { ApiError, errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { useArchiveProject, useProject, useToggleFavorite } from '../api';
import { ProjectLinks } from '../components/ProjectLinks';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { useProjectPermissions } from '../useProjectPermissions';

const TABS = {
  software: [
    { path: 'overview', label: 'Overview', icon: <ChartPie /> },
    { path: 'board', label: 'Board', icon: <KanbanSquare /> },
    { path: 'list', label: 'List', icon: <List /> },
    { path: 'bugs', label: 'Bugs', icon: <Bug /> },
    { path: 'activity', label: 'Activity', icon: <History /> },
    { path: 'settings', label: 'Settings', icon: <Settings /> },
  ],
  household: [
    { path: 'home', label: 'Home', icon: <House /> },
    { path: 'board', label: 'Chores', icon: <KanbanSquare /> },
    { path: 'list', label: 'All tasks', icon: <List /> },
    { path: 'shopping', label: 'Shopping', icon: <ShoppingCart /> },
    { path: 'calendar', label: 'Calendar', icon: <CalendarDays /> },
    { path: 'activity', label: 'Activity', icon: <History /> },
    { path: 'settings', label: 'Settings', icon: <Settings /> },
  ],
};
const ADD_LABEL = { software: 'Add task', household: 'Add chore' };

export function ProjectLayout() {
  const restore = () =>
    archive.mutate(false, {
      onSuccess: () => toast.success('Project restored'),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const { key = '' } = useParams();
  const { openQuickCreate } = useShell();
  const project = useProject(key);
  const favorite = useToggleFavorite();
  const archive = useArchiveProject(key);
  const permissions = useProjectPermissions(project.data);

  if (project.isPending)
    return (
      <div className="flex flex-col gap-4 pt-2">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (project.error instanceof ApiError && project.error.status === 404)
    return <NotFoundPage title="Project not found" description="It doesn't exist, or you're not a member." />;
  if (project.error) return <ErrorState error={project.error} onRetry={project.refetch} />;

  const data = project.data;
  const base = `/p/${data.key}`;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <ProjectAvatar color={data.color} icon={data.icon} size="md" />
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate text-xl font-bold md:text-2xl">{data.name}</h1>
          <ProjectSwitcher currentKey={data.key} />
        </div>
        <Badge className="font-mono" label={data.key} />
        {data.isArchived && <Badge tone="warning" icon={<Archive />} label="Archived" />}
        {data.isDemo && <Badge tone="violet" label="Demo" />}
        <IconButton
          icon={<Star className={cn(data.isFavorite && 'fill-highlight text-highlight')} />}
          label={data.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => favorite.mutate({ key: data.key, favorite: !data.isFavorite })}
        />
        <ProjectLinks project={data} />
        <div className="flex-1" />
        {permissions.can('task.create') && (
          <Button
            leftIcon={<Plus />}
            onClick={() =>
              openQuickCreate({ projectKey: data.key, ...(data.kind === 'household' && { type: 'chore' }) })
            }
          >
            {ADD_LABEL[data.kind]}
          </Button>
        )}
      </div>
      {data.isArchived && (
        <Banner
          tone="warning"
          icon={<Archive />}
          action={
            can(data.permissions, 'project.archive') && (
              <Button size="xs" variant="soft" onClick={restore} loading={archive.isPending}>
                Restore
              </Button>
            )
          }
        >
          This project is archived and read-only.
        </Banner>
      )}
      <TabLinks
        label="Project views"
        items={TABS[data.kind].map((tab) => ({
          to: `${base}/${tab.path}`,
          label: tab.label,
          icon: tab.icon,
        }))}
      />
      <Outlet context={{ project: data }} />
    </div>
  );
}
