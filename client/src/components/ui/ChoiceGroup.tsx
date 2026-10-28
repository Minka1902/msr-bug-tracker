import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  preview?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
  className?: string;
}

export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  columns = 3,
  className,
}: ChoiceGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2', className)}
    >
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={choice.value === value}
          disabled={choice.disabled}
          onClick={() => onChange(choice.value)}
          className="group relative flex cursor-pointer flex-col gap-3 rounded-card border border-border bg-surface p-3 text-left transition-[border-color,box-shadow] hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border aria-checked:border-accent aria-checked:ring-3 aria-checked:ring-accent/20"
        >
          {choice.preview}
          <span className="flex items-start gap-2.5">
            {choice.icon && <span className="mt-0.5 text-muted [&_svg]:size-4.5">{choice.icon}</span>}
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-semibold">{choice.label}</span>
              {choice.description && <span className="text-xs text-muted">{choice.description}</span>}
              {choice.badge && <span className="mt-1.5 flex">{choice.badge}</span>}
            </span>
            <span className="flex size-5 items-center justify-center rounded-full border border-border-strong group-aria-checked:border-accent group-aria-checked:bg-accent group-aria-checked:text-accent-contrast">
              <Check className="hidden size-3 group-aria-checked:block" strokeWidth={3} />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
