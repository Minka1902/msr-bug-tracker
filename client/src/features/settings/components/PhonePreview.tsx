import type { Hand, TouchSize } from '@msr/shared/enums';
import { cn } from '../../../lib/cn';

interface PhonePreviewProps {
  hand: Hand;
  touch: TouchSize;
  className?: string;
}

export function PhonePreview({ hand, touch, className }: PhonePreviewProps) {
  const large = touch === 'large';

  return (
    <div aria-hidden className={cn('flex justify-center rounded-[10px] bg-surface-muted py-3', className)}>
      <div className="relative flex h-28 w-16 flex-col overflow-hidden rounded-[12px] border-2 border-border-strong bg-app">
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          {[0, 1, 2].map((row) => (
            <span key={row} className={cn('rounded-[3px] bg-surface', large ? 'h-4' : 'h-3')} />
          ))}
        </div>
        <span
          className={cn(
            'absolute bottom-6 rounded-full bg-accent',
            large ? 'size-4.5' : 'size-3.5',
            hand === 'right' ? 'right-1.5' : 'left-1.5',
          )}
        />
        <div
          className={cn(
            'flex items-center justify-around border-t border-border bg-surface',
            large ? 'h-5' : 'h-4',
          )}
        >
          {[0, 1, 2, 3].map((tab) => (
            <span key={tab} className={cn('rounded-full bg-border-strong', large ? 'size-2' : 'size-1.5')} />
          ))}
        </div>
      </div>
    </div>
  );
}
