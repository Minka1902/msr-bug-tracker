import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { PROJECT_COLORS } from '../../lib/projectAppearance';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
  allowCustom?: boolean;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  colors = PROJECT_COLORS,
  allowCustom = true,
  className,
}: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="Color" className={cn('flex flex-wrap gap-2', className)}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color}
          aria-label={color}
          onClick={() => onChange(color)}
          style={{ '--c': color } as CSSProperties}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-(--c) text-white ring-offset-2 ring-offset-surface transition-transform hover:scale-110 aria-checked:ring-2 aria-checked:ring-(--c)"
        >
          {value.toLowerCase() === color && <Check className="size-3.5" strokeWidth={3} />}
        </button>
      ))}
      {allowCustom && (
        <label
          title="Custom color"
          className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]"
        >
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom color"
          />
        </label>
      )}
    </div>
  );
}
