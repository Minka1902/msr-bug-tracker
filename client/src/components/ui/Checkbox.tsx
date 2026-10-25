import { Check, Minus } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({ checked, onCheckedChange, label, disabled, className, ...aria }: CheckboxProps) {
  const box = (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-border-strong bg-surface transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50',
        !label && className,
      )}
      {...aria}
    >
      <RadixCheckbox.Indicator className="text-accent-contrast">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );

  if (!label) return box;

  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      {box}
      {label}
    </label>
  );
}
