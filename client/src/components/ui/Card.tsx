import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export const cardVariants = cva('rounded-card', {
  variants: {
    variant: {
      raised: 'border border-border/60 bg-surface-raised shadow-card clean:border-border',
      flat: 'border border-border bg-surface',
      muted: 'bg-surface-muted',
      glass: 'glass border border-white/40 shadow-card dark:border-white/5 clean:border-border',
      inverted: 'bg-surface-inverted text-inverted shadow-card',
    },
    padding: { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' },
    interactive: { true: 'cursor-pointer transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:shadow-pop clean:hover:translate-y-0 clean:hover:border-border-strong' },
  },
  defaultVariants: { variant: 'raised', padding: 'md' },
});

export interface CardProps extends ComponentProps<'div'>, VariantProps<typeof cardVariants> {}

export function Card({ variant, padding, interactive, className, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />;
}
