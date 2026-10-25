import { cva, type VariantProps } from 'class-variance-authority';
import type { CSSProperties, ReactNode } from 'react';
import type { Tone } from '@msr/shared/enums';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 truncate font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        soft: 'chip',
        solid: 'chip-solid',
        outline: 'chip-outline',
        dot: 'text-muted',
        plain: 'tint',
      },
      size: {
        xs: 'h-5 rounded-md px-1.5 text-[11px]',
        sm: 'h-6 rounded-md px-2 text-xs',
        md: 'h-7 rounded-lg px-2.5 text-sm',
      },
      pill: { true: 'rounded-full' },
    },
    defaultVariants: { variant: 'soft', size: 'sm' },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  tone?: Tone;
  color?: string;
  icon?: ReactNode;
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({
  tone = 'neutral',
  color,
  icon,
  label,
  children,
  variant,
  size,
  pill,
  className,
  title,
}: BadgeProps) {
  const style = { '--c': color ?? `var(--tone-${tone})` } as CSSProperties;

  return (
    <span title={title} style={style} className={cn(badgeVariants({ variant, size, pill }), className)}>
      {variant === 'dot' && <span className="size-2 shrink-0 rounded-full bg-(--c)" />}
      {icon}
      {label ?? children}
    </span>
  );
}
