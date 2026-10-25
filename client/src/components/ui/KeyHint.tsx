import { cn } from '../../lib/cn';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

interface KeyHintProps {
  keys: string[];
  className?: string;
}

export function KeyHint({ keys, className }: KeyHintProps) {
  return (
    <span className={cn('hidden items-center gap-0.5 md:inline-flex', className)}>
      {keys.map((key) => (
        <kbd key={key} className="rounded border border-border bg-surface-muted px-1.5 font-sans text-[11px] leading-5 text-muted">
          {key === 'mod' ? (IS_MAC ? '⌘' : 'Ctrl') : key}
        </kbd>
      ))}
    </span>
  );
}
