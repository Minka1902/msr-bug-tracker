import { Badge } from '../../../components/ui/Badge';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useProject } from '../api';
import { ProjectActionsMenu } from './ProjectActionsMenu';
import { ProjectSwitcher } from './ProjectSwitcher';

export function ProjectTopbar({ projectKey }: { projectKey: string }) {
  const project = useProject(projectKey);

  if (project.isPending) return <Skeleton className="h-7 w-40" />;
  if (!project.data) return null;

  const data = project.data;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <ProjectAvatar appearance={data} size="sm" />
      <div className="flex min-w-0 flex-1 items-center">
        <h1 className="truncate text-base font-bold">{data.name}</h1>
        <ProjectSwitcher currentKey={data.key} />
      </div>
      {data.isDemo && <Badge tone="violet" label="Demo" />}
      <ProjectActionsMenu project={data} />
    </div>
  );
}
