import { format } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { toDate } from '../../lib/dates';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { Popover } from './Popover';

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  renderTrigger?: (value: string | null) => ReactNode;
  min?: string | null;
  max?: string | null;
  className?: string;
  'aria-label'?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Set date',
  disabled,
  renderTrigger,
  min,
  max,
  className,
  ...aria
}: DatePickerProps) {
  const select = (date: Date | undefined) => {
    onChange(date ? format(date, 'yyyy-MM-dd') : null);
    setOpen(false);
  };

  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;

  const trigger = renderTrigger ? (
    renderTrigger(value)
  ) : (
    <button
      type="button"
      disabled={disabled}
      aria-label={aria['aria-label']}
      className={cn(
        'inline-flex h-9.5 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
        !value && 'text-subtle',
        className,
      )}
    >
      <CalendarDays className="size-4 text-muted" />
      {value ? format(selected!, 'MMM d, yyyy') : placeholder}
    </button>
  );

  if (disabled) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={trigger} className="p-2">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={select}
        defaultMonth={selected}
        disabled={[...(min ? [{ before: toDate(min) }] : []), ...(max ? [{ after: toDate(max) }] : [])]}
        weekStartsOn={1}
        className="msr-calendar"
      />
      <div className="flex justify-between border-t border-border px-1 pt-2">
        <Button size="xs" variant="ghost" onClick={() => select(new Date())}>
          Today
        </Button>
        {value && (
          <Button size="xs" variant="danger-ghost" leftIcon={<X />} onClick={() => select(undefined)}>
            Clear
          </Button>
        )}
      </div>
    </Popover>
  );
}
