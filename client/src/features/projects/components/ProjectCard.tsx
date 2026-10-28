import { Star } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { MODULE_META } from '@msr/shared/modules';
import type { ProjectSummary } from '@msr/shared/types';
import { cn } from '../../../lib/cn';
import { AvatarGroup } from '../../../components/ui/AvatarGroup';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { DueDate } from '../../tasks/components/DueDate';
import { ProjectHealthBadge } from './ProjectHealthBadge';
import { ProjectLinks } from './ProjectLinks';

interface ProjectCardProps {
  project: ProjectSummary;
  onToggleFavorite?: (project: ProjectSummary) => void;
  className?: string;
}

export function ProjectCard({ project, onToggleFavorite, className }: ProjectCardProps) {
  return (
    <Card padding="sm" interactive className={cn('group relative flex flex-col gap-3', className)}>
      <Link
        to={`/p/${project.key}`}
        className="absolute inset-0 z-0 rounded-card"
        aria-label={project.name}
      />
      <div
        style={{ '--c': project.color } as CSSProperties}
        className="relative flex aspect-[16/8] items-center justify-center overflow-hidden rounded-[calc(var(--r-card)-6px)] bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--c)_22%,transparent),transparent_60%),linear-gradient(135deg,color-mix(in_oklab,var(--c)_14%,var(--c-surface)),color-mix(in_oklab,var(--c)_30%,var(--c-surface)))]"
      >
        {project.emblem ? (
          <ProjectAvatar appearance={project} size="xl" />
        ) : (
          <ProjectIcon
            name={project.icon}
            className="size-12 text-(--c) drop-shadow-[0_8px_14px_color-mix(in_oklab,var(--c)_45%,transparent)]"
            strokeWidth={1.6}
          />
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge size="xs" className="bg-surface/90 font-mono text-text" label={project.key} />
          {project.module !== 'software' && (
            <Badge
              size="xs"
              className="bg-surface/90 text-text"
              icon={<ProjectIcon name={MODULE_META[project.module].icon} />}
              label={MODULE_META[project.module].label}
            />
          )}
        </div>
        {project.isDemo && (
          <Badge size="xs" tone="violet" className="absolute bottom-2 left-2" label="Demo" />
        )}
        <ProjectLinks
          project={project}
          size="xs"
          variant="secondary"
          className="absolute right-2 bottom-2 z-10"
        />
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={`${project.isFavorite ? 'Remove' : 'Add'} ${project.name} ${project.isFavorite ? 'from' : 'to'} favorites`}
            aria-pressed={project.isFavorite}
            onClick={() => onToggleFavorite(project)}
            className={cn(
              'absolute top-2 right-2 z-10 flex size-7 tap-target cursor-pointer items-center justify-center rounded-full bg-surface/90 text-subtle transition-opacity hover:text-highlight',
              !project.isFavorite &&
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100',
            )}
          >
            <Star className={cn('size-4', project.isFavorite && 'fill-highlight text-highlight')} />
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 px-1">
        <h3 className="line-clamp-2 text-[15px] leading-tight font-bold">{project.name}</h3>
        <ProjectHealthBadge project={project} />
      </div>
      <p className="line-clamp-2 min-h-8 px-1 text-xs text-muted">
        {project.description || 'No description yet.'}
      </p>
      <ProgressBar
        value={project.stats.progress}
        color={project.color}
        label={`${project.stats.completed}/${project.stats.total} done`}
        showValue
        className="px-1"
      />
      <div className="mt-auto flex items-center justify-between gap-2 px-1 pb-1">
        <AvatarGroup people={project.members} max={3} />
        {project.nextDueDate ? (
          <DueDate date={project.nextDueDate} />
        ) : (
          <span className="text-xs text-subtle">No deadlines</span>
        )}
      </div>
    </Card>
  );
}
