import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const fieldVariants = cva(
  'w-full rounded-control border bg-surface text-text placeholder:text-subtle transition-[border-color,box-shadow] outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger',
  {
    variants: {
      size: { sm: 'h-8 text-sm', md: 'h-9.5 text-sm', lg: 'h-11 text-base' },
      tone: { default: 'border-border', ghost: 'border-transparent bg-transparent hover:bg-surface-muted' },
    },
    defaultVariants: { size: 'md', tone: 'default' },
  },
);

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'>, VariantProps<typeof fieldVariants> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  invalid?: boolean;
  wrapperClassName?: string;
}

export function Input({ leftIcon, rightSlot, invalid, size, tone, className, wrapperClassName, ...props }: InputProps) {
  return (
    <div className={cn('relative flex items-center', wrapperClassName)}>
      {leftIcon && <span className="pointer-events-none absolute left-3 text-subtle [&_svg]:size-4">{leftIcon}</span>}
      <input
        aria-invalid={invalid || undefined}
        className={cn(fieldVariants({ size, tone }), 'px-3', leftIcon && 'pl-9', rightSlot && 'pr-10', className)}
        {...props}
      />
      {rightSlot && <span className="absolute right-1.5 flex items-center">{rightSlot}</span>}
    </div>
  );
}
