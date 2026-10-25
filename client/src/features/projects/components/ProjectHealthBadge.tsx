import type { ProjectSummary } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';

export function ProjectHealthBadge({ project }: { project: ProjectSummary }) {
  if (project.isArchived) return <Badge size="xs" label="Archived" />;
  if (project.stats.overdue > 0) return <Badge tone="danger" size="xs" label={`${project.stats.overdue} overdue`} />;
  if (project.stats.total === 0) return <Badge tone="info" size="xs" label="New" />;
  if (project.stats.progress === 100) return <Badge tone="success" size="xs" label="Complete" />;
  return <Badge tone="success" size="xs" label="On track" />;
}
