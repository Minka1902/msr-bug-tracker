import { useId } from 'react';
import type { Emblem } from '@msr/shared/emblem';
import { cn } from '../../lib/cn';
import { DIVIDER_UNIT, PATTERN_GEOMETRY, SHAPE_PATHS } from '../../lib/emblemGeometry';
import { ProjectIcon } from './ProjectIcon';

interface ProjectEmblemProps {
  emblem: Emblem;
  icon?: string | null;
  className?: string;
}

export function ProjectEmblem({ emblem, icon, className }: ProjectEmblemProps) {
  const clipId = `emblem-${useId().replace(/[^\w-]/g, '')}`;
  const { parts, dividers } = PATTERN_GEOMETRY[emblem.pattern];

  return (
    <>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        data-emblem={emblem.pattern}
        className={cn('absolute inset-0 size-full! drop-shadow-[0_2px_3px_rgb(15_23_42/0.18)]', className)}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={SHAPE_PATHS[emblem.shape]} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {parts.map((path, index) => (
            <path key={index} d={path} fill={emblem.colors[index]} />
          ))}
          {emblem.divider.width > 0 && dividers && (
            <path
              d={dividers}
              fill="none"
              stroke={emblem.divider.color}
              strokeWidth={emblem.divider.width * DIVIDER_UNIT}
              strokeLinejoin="round"
            />
          )}
        </g>
      </svg>
      {emblem.showIcon && (
        <ProjectIcon name={icon} className="relative" style={{ color: emblem.iconColor }} />
      )}
    </>
  );
}
