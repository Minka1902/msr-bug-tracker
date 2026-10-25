import { Switch as RadixSwitch } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  size = 'md',
  className,
  id,
}: SwitchProps) {
  const control = (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-border-strong transition-colors data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-4.5 w-8' : 'h-5.5 w-10',
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block rounded-full bg-white shadow-sm transition-transform',
          size === 'sm'
            ? 'size-3.5 translate-x-0.5 data-[state=checked]:translate-x-4'
            : 'size-4.5 translate-x-0.5 data-[state=checked]:translate-x-5',
        )}
      />
    </RadixSwitch.Root>
  );

  if (!label) return control;

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
      {control}
    </label>
  );
}
