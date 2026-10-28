import { Clock, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';

export type ModuleStatus = 'included' | 'locked' | 'coming_soon';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  features: readonly string[];
  status: ModuleStatus;
  statusLabel?: string;
  badges?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const STATUS_BADGE = {
  included: { tone: 'success', icon: undefined, label: 'Included' },
  locked: { tone: 'neutral', icon: <Lock />, label: 'Locked' },
  coming_soon: { tone: 'violet', icon: <Clock />, label: 'Coming soon' },
} as const;

export function ModuleCard({
  title,
  description,
  icon,
  features,
  status,
  statusLabel,
  badges,
  action,
  children,
  className,
}: ModuleCardProps) {
  const badge = STATUS_BADGE[status];

  return (
    <Card
      aria-label={title}
      className={cn('flex flex-col gap-3', status === 'coming_soon' && 'opacity-75', className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text [&_svg]:size-5">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <Badge size="xs" tone={badge.tone} icon={badge.icon} label={statusLabel ?? badge.label} />
          </div>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
      {children}
      {action && <div className="mt-auto flex flex-wrap gap-2">{action}</div>}
    </Card>
  );
}
