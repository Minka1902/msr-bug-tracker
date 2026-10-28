import { useState } from 'react';
import { PACK_MAX, PACK_PRESETS } from '@msr/shared/modules';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { cn } from '../../../lib/cn';

interface PackPickerProps {
  label: string;
  onBuy: (projects: number) => void;
  presets?: readonly number[];
  max?: number;
  pending?: boolean;
  className?: string;
}

export function PackPicker({
  label,
  onBuy,
  presets = PACK_PRESETS,
  max = PACK_MAX,
  pending,
  className,
}: PackPickerProps) {
  const [custom, setCustom] = useState('');
  const amount = Number(custom);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= max;

  return (
    <div className={cn('flex flex-col gap-2 rounded-control bg-surface-muted/60 p-3', className)}>
      <p className="text-xs font-semibold text-muted">Buy {label} projects</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((size) => (
          <Button key={size} size="sm" variant="secondary" disabled={pending} onClick={() => onBuy(size)}>
            {size} projects
            <Badge size="xs" tone="success" label="Sale" />
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onBuy(amount);
          setCustom('');
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          size="sm"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={`1–${max}`}
          aria-label={`How many ${label} projects`}
          wrapperClassName="w-24"
        />
        <Button type="submit" size="sm" variant="soft" disabled={!valid || pending}>
          Get
        </Button>
      </form>
    </div>
  );
}
