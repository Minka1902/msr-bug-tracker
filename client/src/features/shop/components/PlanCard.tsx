import { Bot, Check, FolderPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { MODULE_META, PLAN_META, PROJECT_MODULES, type PlanTier } from '@msr/shared/modules';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { cn } from '../../../lib/cn';

interface PlanCardProps {
  tier: PlanTier;
  current?: boolean;
  action?: ReactNode;
  className?: string;
}

const BOT_TEXT = {
  none: 'No Telegram bot',
  household: 'Telegram bot for households',
  all: 'Telegram bot on any project',
};

export function PlanCard({ tier, current, action, className }: PlanCardProps) {
  const plan = PLAN_META[tier];
  const modules = PROJECT_MODULES.filter((module) => plan.modules.includes(module));

  return (
    <Card
      aria-label={`${plan.label} plan`}
      className={cn('flex flex-col gap-4', current && 'border-accent ring-3 ring-accent/20', className)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{plan.label}</h3>
          {current ? (
            <Badge tone="accent" icon={<Check />} label="Current plan" />
          ) : (
            tier !== 'free' && <Badge tone="success" label="Free during launch" />
          )}
        </div>
        <p className="text-sm text-muted">{plan.description}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {modules.map((module) => (
          <li key={module} className="flex items-center gap-2">
            <ProjectIcon name={MODULE_META[module].icon} className="size-4 text-muted" aria-hidden />
            {MODULE_META[module].label}
          </li>
        ))}
        <li className={cn('flex items-center gap-2', plan.bot === 'none' && 'text-subtle')}>
          <Bot className="size-4 text-muted" aria-hidden />
          {BOT_TEXT[plan.bot]}
        </li>
        <li className="flex items-center gap-2">
          <FolderPlus className="size-4 text-muted" aria-hidden />
          {plan.projectsPerYear} new projects a year
        </li>
      </ul>
      {action && <div className="mt-auto flex">{action}</div>}
    </Card>
  );
}
