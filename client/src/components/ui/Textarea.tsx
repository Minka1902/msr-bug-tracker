import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import { fieldVariants } from './Input';

interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldVariants(), 'h-auto field-sizing-content min-h-20 px-3 py-2', className)}
      {...props}
    />
  );
}
