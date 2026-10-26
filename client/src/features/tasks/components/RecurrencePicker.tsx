import { Repeat } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RECURRENCE_FREQUENCIES, RECURRENCE_META, type RecurrenceFrequency } from '@msr/shared/enums';
import { describeRecurrence } from '@msr/shared/recurrence';
import type { TaskRecurrence, UserRef } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Popover } from '../../../components/ui/Popover';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { cn } from '../../../lib/cn';

interface RecurrencePickerProps {
  value: TaskRecurrence | null;
  onChange: (value: TaskRecurrence | null) => void;
  members?: UserRef[];
  disabled?: boolean;
  placeholder?: string;
  renderTrigger?: (value: TaskRecurrence | null) => ReactNode;
  className?: string;
  'aria-label'?: string;
}

type Frequency = RecurrenceFrequency | 'none';

const MAX_INTERVAL = 365;

export function RecurrencePicker({
  value,
  onChange,
  members = [],
  disabled,
  placeholder = "Doesn't repeat",
  renderTrigger,
  className,
  'aria-label': ariaLabel = 'Repeat',
}: RecurrencePickerProps) {
  const openChange = (next: boolean) => {
    if (next) {
      setFrequency(value?.freq ?? 'none');
      setIntervalText(String(value?.interval ?? 1));
      setRotate(value?.rotate ?? []);
    }
    setOpen(next);
  };

  const save = () => {
    onChange(
      frequency === 'none'
        ? null
        : {
            freq: frequency,
            interval: Math.min(Math.max(Number(intervalText) || 1, 1), MAX_INTERVAL),
            rotate,
          },
    );
    setOpen(false);
  };

  const nameOf = (id: string) => members.find((member) => member.id === id)?.name ?? 'Former member';

  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('none');
  const [intervalText, setIntervalText] = useState('1');
  const [rotate, setRotate] = useState<string[]>([]);

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
            <Repeat className="size-4 text-subtle" aria-hidden />
            <span className={cn('truncate', !value && 'text-subtle')}>
              {value ? describeRecurrence(value) : placeholder}
            </span>
          </button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label="Repeat"
          size="sm"
          block
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: 'none', label: 'Never' },
            ...RECURRENCE_FREQUENCIES.map((freq) => ({ value: freq, label: RECURRENCE_META[freq].label })),
          ]}
        />
        {frequency !== 'none' && (
          <>
            <Field label="Every" htmlFor="recurrence-interval">
              <div className="flex items-center gap-2">
                <Input
                  id="recurrence-interval"
                  type="number"
                  min={1}
                  max={MAX_INTERVAL}
                  value={intervalText}
                  onChange={(event) => setIntervalText(event.target.value)}
                  wrapperClassName="w-20"
                />
                <span className="text-sm text-muted">
                  {RECURRENCE_META[frequency].unit}
                  {Number(intervalText) === 1 ? '' : 's'}
                </span>
              </div>
            </Field>
            {members.length > 1 && (
              <Field label="Take turns" hint="The next one goes to the next person, in this order.">
                <OptionPicker
                  multiple
                  aria-label="Take turns"
                  placeholder="Same person every time"
                  value={rotate}
                  onChange={setRotate}
                  options={members.map((member) => ({
                    value: member.id,
                    label: member.name,
                    icon: <Avatar name={member.name} src={member.avatarUrl} size="xs" decorative />,
                  }))}
                  className="w-full"
                />
                {rotate.length > 1 && <p className="text-xs text-muted">{rotate.map(nameOf).join(' → ')}</p>}
              </Field>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Popover>
  );
}
