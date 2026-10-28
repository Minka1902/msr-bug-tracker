import type { PlanStatus } from '@msr/shared/types';
import { PLAN_META } from '@msr/shared/modules';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { formatShortDate } from '../../../lib/dates';

interface PlanUsageProps {
  plan: PlanStatus;
  className?: string;
}

export function PlanUsage({ plan, className }: PlanUsageProps) {
  const { label, projectsPerYear } = PLAN_META[plan.tier];

  return (
    <ProgressBar
      value={(plan.projectsUsed * 100) / projectsPerYear}
      label={`${label} · ${plan.projectsUsed} of ${projectsPerYear} new projects ${
        plan.expiresAt ? `until ${formatShortDate(plan.expiresAt)}` : 'in the last 12 months'
      }`}
      size="sm"
      className={className}
    />
  );
}
