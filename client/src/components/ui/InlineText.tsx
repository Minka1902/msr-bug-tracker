import { useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
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
  multiline?: boolean;
}

export function InlineText({
  value,
  onSave,
  disabled,
  placeholder,
  maxLength,
  className,
  allowEmpty,
  multiline,
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

  const handleKey = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
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

  const shared = {
    value: draft,
    disabled,
    placeholder,
    maxLength,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: (_event: FocusEvent) => commit(),
    onKeyDown: handleKey,
    className: cn(
      'w-full min-w-0 rounded-[calc(var(--r-control)-3px)] border border-transparent bg-transparent px-2 text-sm outline-none transition-colors hover:border-border focus:border-accent focus:bg-surface disabled:cursor-default disabled:hover:border-transparent',
      multiline ? 'field-sizing-content resize-none py-1' : 'h-8',
      className,
    ),
    ...aria,
  };

  return multiline ? <textarea rows={1} {...shared} /> : <input {...shared} />;
}
