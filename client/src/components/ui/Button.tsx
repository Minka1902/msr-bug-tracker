import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[color,background-color,box-shadow,filter] select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast shadow-sm hover:bg-accent-hover',
        secondary: 'border border-border bg-surface text-text shadow-xs hover:bg-surface-muted',
        ghost: 'text-muted hover:bg-surface-muted hover:text-text',
        soft: 'bg-accent-soft text-accent-text hover:brightness-95 dark:hover:brightness-125',
        danger: 'bg-danger-fill text-white shadow-sm hover:brightness-110',
        'danger-ghost': 'text-danger hover:bg-danger/10',
        link: 'text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9.5 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        'icon-xs': 'size-7 [&_svg]:size-3.5',
        'icon-sm': 'size-8',
        'icon-md': 'size-9.5',
        'icon-lg': 'size-11 [&_svg]:size-5',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

export function Button({
  asChild,
  leftIcon,
  rightIcon,
  loading,
  variant,
  size,
  block,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';

  return (
    <Component
      type={asChild ? undefined : type}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon}
      <Slot.Slottable>{children}</Slot.Slottable>
      {rightIcon}
    </Component>
  );
}
