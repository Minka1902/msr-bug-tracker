import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { ColorPicker } from './ColorPicker';
import { Popover } from './Popover';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  colors?: string[];
}

export function ColorSwatchPicker({
  value,
  onChange,
  disabled,
  size = 'sm',
  label = 'Change color',
  colors,
}: ColorSwatchPickerProps) {
  const swatch = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      style={{ '--c': value } as CSSProperties}
      className={cn(
        'shrink-0 tap-target cursor-pointer rounded-full bg-(--c) shadow-[inset_0_0_0_1px_var(--c-border-strong)] ring-offset-2 ring-offset-surface transition-shadow hover:ring-2 hover:ring-(--c)/50 disabled:cursor-default disabled:hover:ring-0',
        size === 'sm' ? 'size-4' : 'size-6',
      )}
    />
  );

  if (disabled) return swatch;

  return (
    <Popover trigger={swatch} className="w-64 p-3" title={label}>
      <ColorPicker value={value} onChange={onChange} colors={colors} />
    </Popover>
  );
}
