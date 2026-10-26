import { cva, type VariantProps } from 'class-variance-authority';
import type { CSSProperties } from 'react';
import type { Emblem } from '@msr/shared/emblem';
import { cn } from '../../lib/cn';
import { ProjectEmblem } from './ProjectEmblem';
import { ProjectIcon } from './ProjectIcon';

const projectAvatarVariants = cva('relative inline-flex shrink-0 items-center justify-center text-white', {
  variants: {
    size: {
      xs: 'size-5 rounded-md [&_svg]:size-3',
      sm: 'size-7 rounded-lg [&_svg]:size-4',
      md: 'size-9 rounded-[10px] [&_svg]:size-5',
      lg: 'size-12 rounded-xl [&_svg]:size-6',
      xl: 'size-20 rounded-2xl [&_svg]:size-10',
    },
    variant: {
      gradient:
        'bg-[linear-gradient(135deg,color-mix(in_oklab,var(--c)_70%,white),var(--c))] shadow-[0_6px_16px_-6px_var(--c)] clean:bg-(--c) clean:shadow-none',
      soft: 'chip',
      dot: 'size-2.5! rounded-full bg-(--c) [&_svg]:hidden',
      emblem: '',
    },
  },
  defaultVariants: { size: 'sm', variant: 'gradient' },
});

export interface ProjectAppearance {
  color: string;
  icon?: string | null;
  emblem?: Emblem | null;
}

interface ProjectAvatarProps extends VariantProps<typeof projectAvatarVariants> {
  appearance: ProjectAppearance;
  className?: string;
}

export function ProjectAvatar({ appearance, size, variant, className }: ProjectAvatarProps) {
  const { color, icon, emblem } = appearance;
  const flag = emblem && variant !== 'dot';

  return (
    <span
      aria-hidden
      style={{ '--c': color } as CSSProperties}
      className={cn(projectAvatarVariants({ size, variant: flag ? 'emblem' : variant }), className)}
    >
      {flag ? <ProjectEmblem emblem={emblem} icon={icon} /> : <ProjectIcon name={icon} />}
    </span>
  );
}
