import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { PROJECT_ICONS } from '../../lib/projectAppearance';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
  className?: string;
}

export function IconPicker({ value, onChange, color = 'var(--c-accent)', className }: IconPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Icon"
      style={{ '--c': color } as CSSProperties}
      className={cn('grid grid-cols-8 gap-1.5', className)}
    >
      {Object.entries(PROJECT_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={() => onChange(name)}
          className="flex aspect-square cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-muted hover:text-text aria-checked:chip"
        >
          <Icon className="size-4.5" />
        </button>
      ))}
    </div>
  );
}
