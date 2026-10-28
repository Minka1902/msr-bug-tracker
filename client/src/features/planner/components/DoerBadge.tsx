import { Bot, Sparkles, User } from 'lucide-react';
import type { Doer } from '@msr/shared/schemas/planner';
import { Badge } from '../../../components/ui/Badge';

interface DoerBadgeProps {
  doer: Doer;
  className?: string;
}

const DOER_BADGES = {
  human: { tone: 'info', icon: <User />, label: 'You' },
  ai: { tone: 'violet', icon: <Bot />, label: 'AI' },
  skill: { tone: 'accent', icon: <Sparkles />, label: 'Skill' },
} as const;

export function DoerBadge({ doer, className }: DoerBadgeProps) {
  const badge = DOER_BADGES[doer];
  return <Badge size="xs" tone={badge.tone} icon={badge.icon} label={badge.label} className={className} />;
}
