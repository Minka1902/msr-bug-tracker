import { DURATION_PRESETS } from '@msr/shared/calendar';
import { formatMinutes } from '../../lib/dates';
import { OptionPicker } from './OptionPicker';

interface DurationPickerProps {
  value: number;
  onChange: (minutes: number) => void;
  options?: readonly number[];
  max?: number;
  className?: string;
  'aria-label'?: string;
}

const DEFAULT_MAX = 24 * 60;

export function DurationPicker({
  value,
  onChange,
  options = DURATION_PRESETS,
  max = DEFAULT_MAX,
  className,
  'aria-label': ariaLabel = 'Duration',
}: DurationPickerProps) {
  const choices = [...new Set([...options, value])].sort((a, b) => a - b);

  return (
    <OptionPicker
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(next) => next && onChange(Number(next))}
      options={choices.map((minutes) => ({ value: String(minutes), label: formatMinutes(minutes) }))}
      searchable
      searchPlaceholder="Minutes, like 50"
      onCreate={(query) => {
        const minutes = Math.round(Number(query));
        if (minutes > 0 && minutes <= max) onChange(minutes);
      }}
      createLabel={(query) => `Use ${query} minutes`}
      className={className}
    />
  );
}
