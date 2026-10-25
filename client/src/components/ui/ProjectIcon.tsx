import { Hexagon, type LucideProps } from 'lucide-react';
import { PROJECT_ICONS } from '../../lib/projectAppearance';

interface ProjectIconProps extends Omit<LucideProps, 'name'> {
  name: string | null | undefined;
}

export function ProjectIcon({ name, ...props }: ProjectIconProps) {
  const Icon = PROJECT_ICONS[name ?? ''] ?? Hexagon;
  return <Icon {...props} />;
}
