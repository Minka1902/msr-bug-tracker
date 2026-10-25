import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label?: ReactNode;
  icon?: ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  label?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, size = 'md', block, className, label }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-1 rounded-control border border-border bg-surface-muted p-1', block && 'flex w-full', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--r-control)-4px)] font-medium text-muted transition-colors hover:text-text [&_svg]:size-4',
            size === 'sm' ? 'h-6.5 px-2 text-xs' : 'h-8 px-3 text-sm',
            block && 'flex-1',
            'aria-checked:bg-accent aria-checked:text-accent-contrast aria-checked:shadow-sm clean:aria-checked:bg-surface clean:aria-checked:text-text',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
