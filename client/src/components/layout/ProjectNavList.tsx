import { Plus, Star } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';
import { ProjectAvatar } from '../ui/ProjectAvatar';
import type { ShellProject } from './shellTypes';

interface ProjectNavListProps {
  projects: ShellProject[];
  onCreateProject: () => void;
  onNavigate?: () => void;
  limit?: number;
  className?: string;
}

export function ProjectNavList({
  projects,
  onCreateProject,
  onNavigate,
  limit = 12,
  className,
}: ProjectNavListProps) {
  const sorted = [
    ...projects.filter((project) => project.isFavorite),
    ...projects.filter((project) => !project.isFavorite),
  ].slice(0, limit);

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {sorted.map((project) => (
        <NavLink
          key={project.key}
          to={`/p/${project.key}`}
          onClick={onNavigate}
          className="group flex h-9 tap-size items-center gap-2.5 rounded-control px-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-text aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-text clean:aria-[current=page]:bg-nav-active clean:aria-[current=page]:text-nav-active-text"
        >
          <ProjectAvatar appearance={project} size="xs" />
          <span className="flex-1 truncate">{project.name}</span>
          {project.isFavorite && <Star className="size-3.5 fill-current text-warning" />}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onCreateProject}
        className="flex h-9 tap-size cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-subtle transition-colors hover:bg-surface-muted hover:text-text"
      >
        <Plus className="size-4" />
        Add project
      </button>
    </div>
  );
}
