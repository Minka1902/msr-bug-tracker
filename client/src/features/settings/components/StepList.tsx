import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export interface Step {
  icon: ReactNode;
  text: ReactNode;
}

interface StepListProps {
  steps: Step[];
  className?: string;
}

export function StepList({ steps, className }: StepListProps) {
  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control tint text-accent-text [--c:var(--c-accent)] [&>svg]:size-4">
            {step.icon}
          </span>
          <span className="pt-1.5">
            <span className="font-medium">{index + 1}.</span> {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
