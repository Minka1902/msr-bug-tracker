import { Bell } from 'lucide-react';
import { REMINDER_PRESETS } from '@msr/shared/calendar';
import { cn } from '../../lib/cn';
import { formatMinutes } from '../../lib/dates';

interface ReminderPickerProps {
  value: number[];
  onChange: (minutes: number[]) => void;
  options?: readonly number[];
  max?: number;
  className?: string;
  'aria-label'?: string;
}

const DEFAULT_MAX = 5;

export function ReminderPicker({
  value,
  onChange,
  options = REMINDER_PRESETS,
  max = DEFAULT_MAX,
  className,
  'aria-label': ariaLabel = 'Remind me',
}: ReminderPickerProps) {
  const toggle = (minutes: number) =>
    onChange(
      value.includes(minutes)
        ? value.filter((item) => item !== minutes)
        : [...value, minutes].sort((a, b) => b - a).slice(0, max),
    );

  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((minutes) => (
        <button
          key={minutes}
          type="button"
          aria-pressed={value.includes(minutes)}
          onClick={() => toggle(minutes)}
          className="inline-flex tap-target cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-border-strong aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-text [&_svg]:size-3.5"
        >
          {value.includes(minutes) && <Bell aria-hidden />}
          {formatMinutes(minutes)} before
        </button>
      ))}
    </div>
  );
}
