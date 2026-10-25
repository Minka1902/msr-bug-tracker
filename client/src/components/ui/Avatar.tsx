import { cva, type VariantProps } from 'class-variance-authority';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none',
  {
    variants: {
      size: {
        xs: 'size-5 text-[9px]',
        sm: 'size-6 text-[10px]',
        md: 'size-8 text-xs',
        lg: 'size-10 text-sm',
        xl: 'size-16 text-xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  className?: string;
  ring?: boolean;
  decorative?: boolean;
}

const hueOf = (value: string) => [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 7);

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

export function Avatar({ name, src, size, className, ring, decorative }: AvatarProps) {
  const style = { '--h': hueOf(name) } as CSSProperties;

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      title={name}
      style={style}
      className={cn(
        avatarVariants({ size }),
        'bg-[oklch(0.86_0.08_var(--h))] text-[oklch(0.35_0.1_var(--h))] dark:bg-[oklch(0.42_0.1_var(--h))] dark:text-[oklch(0.93_0.04_var(--h))]',
        ring && 'ring-2 ring-surface',
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initialsOf(name)}
    </span>
  );
}
