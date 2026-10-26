import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { PRIORITY_RANK } from '@msr/shared/enums';
import { describeEscalation } from '@msr/shared/escalation';
import type { EscalationRange } from '@msr/shared/types';
import { cn } from '../../../lib/cn';

interface EscalationMarkProps {
  escalation: EscalationRange;
  className?: string;
}

export function EscalationMark({ escalation, className }: EscalationMarkProps) {
  const Icon = PRIORITY_RANK[escalation.to] < PRIORITY_RANK[escalation.from] ? ChevronsUp : ChevronsDown;

  return (
    <Icon
      role="img"
      aria-label={`Priority schedule: ${describeEscalation(escalation)}`}
      className={cn('size-3.5 shrink-0 text-subtle', className)}
    />
  );
}
