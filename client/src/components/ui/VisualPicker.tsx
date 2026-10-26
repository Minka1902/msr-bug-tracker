import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface VisualOption<T extends string> {
  value: T;
  label: string;
  render: ReactNode;
}

interface VisualPickerProps<T extends string> {
  label: string;
  value: T;
  options: VisualOption<T>[];
  onChange: (value: T) => void;
  color?: string;
  className?: string;
  itemClassName?: string;
}

export function VisualPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  color = 'var(--c-accent)',
  className,
  itemClassName,
}: VisualPickerProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ '--c': color } as CSSProperties}
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5 pointer-coarse:grid-cols-[repeat(auto-fill,minmax(var(--tap),1fr))]',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex aspect-square tap-size cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-muted hover:text-text aria-checked:chip',
            itemClassName,
          )}
        >
          {option.render}
        </button>
      ))}
    </div>
  );
}
