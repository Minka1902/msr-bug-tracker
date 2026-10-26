import { ChevronsUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PRIORITY_META } from '@msr/shared/enums';
import {
  describeEscalation,
  escalatedPriority,
  escalationSteps,
  PRIORITY_LEVELS,
} from '@msr/shared/escalation';
import type { EscalationRange, TaskEscalation } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Popover } from '../../../components/ui/Popover';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { cn } from '../../../lib/cn';
import { formatShortDate, todayIso } from '../../../lib/dates';
import { PriorityIcon } from '../taskMeta';

interface EscalationPickerProps {
  value: TaskEscalation | null;
  onChange: (value: EscalationRange | null) => void;
  startDate: string | null;
  dueDate: string;
  disabled?: boolean;
  placeholder?: string;
  renderTrigger?: (value: TaskEscalation | null) => ReactNode;
  className?: string;
  'aria-label'?: string;
}

const DEFAULT_RANGE: EscalationRange = { from: 'low', to: 'urgent' };

const PRIORITY_OPTIONS = PRIORITY_LEVELS.map((priority) => ({
  value: priority,
  label: PRIORITY_META[priority].label,
}));

export function EscalationPicker({
  value,
  onChange,
  startDate,
  dueDate,
  disabled,
  placeholder = "Doesn't change",
  renderTrigger,
  className,
  'aria-label': ariaLabel = 'Priority schedule',
}: EscalationPickerProps) {
  const openChange = (next: boolean) => {
    if (next) setDraft(value ?? DEFAULT_RANGE);
    setOpen(next);
  };

  const save = (next: EscalationRange | null) => {
    onChange(next);
    setOpen(false);
  };

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_RANGE);

  const today = todayIso();
  const valid = draft.from !== draft.to;
  const firstDay = startDate ?? (value?.from === draft.from && value.to === draft.to ? value.since : today);
  const steps = valid ? escalationSteps(draft, firstDay, dueDate) : [];
  const current = valid ? escalatedPriority(draft, firstDay, dueDate, today) : null;

  return (
    <Popover
      open={open}
      onOpenChange={openChange}
      className="w-80 p-3"
      trigger={
        renderTrigger ? (
          renderTrigger(value)
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              'inline-flex h-9.5 tap-size cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
              className,
            )}
          >
            <ChevronsUp className="size-4 text-subtle" aria-hidden />
            <span className={cn('truncate', !value && 'text-subtle')}>
              {describeEscalation(value) ?? placeholder}
            </span>
          </button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted">
          The priority moves one step at a time and reaches the end priority by the due date.
        </p>
        <Field label="Start priority">
          <SegmentedControl
            label="Start priority"
            size="sm"
            block
            value={draft.from}
            onChange={(from) => setDraft({ ...draft, from })}
            options={PRIORITY_OPTIONS}
          />
        </Field>
        <Field label="End priority" error={valid ? undefined : 'Pick two different priorities'}>
          <SegmentedControl
            label="End priority"
            size="sm"
            block
            value={draft.to}
            onChange={(to) => setDraft({ ...draft, to })}
            options={PRIORITY_OPTIONS}
          />
        </Field>
        {valid && (
          <ol
            aria-label="Steps"
            className="flex flex-col gap-1.5 rounded-control bg-surface-muted/60 p-2.5 text-sm"
          >
            {steps.map((step) => (
              <li key={step.priority} className="flex items-center gap-2">
                <PriorityIcon priority={step.priority} decorative />
                <span className={cn(step.priority === current && 'font-semibold')}>
                  {PRIORITY_META[step.priority].label}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {step.priority === current ? 'Now' : `From ${formatShortDate(step.from)}`}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center gap-2">
          {value && (
            <Button size="sm" variant="danger-ghost" onClick={() => save(null)}>
              Turn off
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid} onClick={() => save(draft)}>
            Save
          </Button>
        </div>
      </div>
    </Popover>
  );
}
