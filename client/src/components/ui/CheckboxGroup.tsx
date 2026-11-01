import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Checkbox } from './Checkbox';

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
}

interface CheckboxGroupProps {
  options: CheckboxGroupOption[];
  value: string[];
  onChange: (value: string[]) => void;
  lockedValues?: string[];
  disabled?: boolean;
  className?: string;
}

export function CheckboxGroup({
  options,
  value,
  onChange,
  lockedValues = [],
  disabled,
  className,
}: CheckboxGroupProps) {
  const toggle = (option: string, checked: boolean) =>
    onChange(checked ? [...value, option] : value.filter((item) => item !== option));

  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
      {options.map((option) => {
        const locked = lockedValues.includes(option.value);
        return (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={locked || value.includes(option.value)}
            disabled={disabled || locked}
            onCheckedChange={(checked) => toggle(option.value, checked)}
          />
        );
      })}
    </div>
  );
}
