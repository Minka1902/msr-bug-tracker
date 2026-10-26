import { Link } from 'react-router';
import type { ProjectSummary } from '@msr/shared/types';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { ProjectHealthBadge } from '../../projects/components/ProjectHealthBadge';

export function ProjectProgressRow({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to={`/p/${project.key}`}
      className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-muted"
    >
      <ProjectAvatar appearance={project} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{project.name}</span>
          <span className="font-mono text-[11px] text-subtle">{project.key}</span>
          <span className="flex-1" />
          <ProjectHealthBadge project={project} />
        </div>
        <ProgressBar
          value={project.stats.progress}
          color={project.color}
          size="xs"
          aria-label={`${project.name} progress`}
        />
      </div>
      <span className="w-12 text-right text-xs font-semibold tabular-nums">{project.stats.progress}%</span>
    </Link>
  );
}
