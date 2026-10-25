import { useState, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';

interface InlineTextProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  'aria-label': string;
  allowEmpty?: boolean;
}

export function InlineText({
  value,
  onSave,
  disabled,
  placeholder,
  maxLength,
  className,
  allowEmpty,
  ...aria
}: InlineTextProps) {
  const commit = () => {
    const next = draft.trim();
    if ((!next && !allowEmpty) || next === value) {
      setDraft(value);
      return;
    }
    onSave(next);
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(value);
      requestAnimationFrame(() => event.currentTarget?.blur());
    }
  };

  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  return (
    <input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      className={cn(
        'h-8 w-full min-w-0 rounded-[calc(var(--r-control)-3px)] border border-transparent bg-transparent px-2 text-sm outline-none transition-colors hover:border-border focus:border-accent focus:bg-surface disabled:cursor-default disabled:hover:border-transparent',
        className,
      )}
      {...aria}
    />
  );
}
