import { FolderGit2, Globe } from 'lucide-react';
import type { ProjectSummary } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { cn } from '../../../lib/cn';

interface ProjectLinksProps {
  project: Pick<ProjectSummary, 'name' | 'liveUrl' | 'repoUrl'>;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
  className?: string;
}

const LINKS = [
  { key: 'liveUrl', label: 'Open live site', icon: <Globe /> },
  { key: 'repoUrl', label: 'Open repository', icon: <FolderGit2 /> },
] as const;

export function ProjectLinks({ project, size = 'sm', variant = 'ghost', className }: ProjectLinksProps) {
  const links = LINKS.filter((link) => project[link.key]);
  if (!links.length) return null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {links.map((link) => (
        <Tooltip key={link.key} content={link.label}>
          <Button asChild size={`icon-${size}`} variant={variant}>
            <a
              href={project[link.key]!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} of ${project.name}`}
            >
              {link.icon}
            </a>
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}
