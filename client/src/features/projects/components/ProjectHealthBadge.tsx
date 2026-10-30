import type { ProjectSummary } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';

export function ProjectHealthBadge({ project, className }: { project: ProjectSummary; className?: string }) {
  if (project.isArchived) return <Badge size="xs" label="Archived" className={className} />;
  if (project.stats.overdue > 0)
    return <Badge tone="danger" size="xs" label={`${project.stats.overdue} overdue`} className={className} />;
  if (project.stats.total === 0) return <Badge tone="info" size="xs" label="New" className={className} />;
  if (project.stats.progress === 100)
    return <Badge tone="success" size="xs" label="Complete" className={className} />;
  return <Badge tone="success" size="xs" label="On track" className={className} />;
}
