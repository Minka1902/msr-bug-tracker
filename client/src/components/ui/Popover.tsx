import { Popover as RadixPopover } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  modal?: boolean;
}

export const popoverSurface =
  'z-50 rounded-control border border-border bg-surface-raised text-text shadow-pop outline-none';

export function Popover({ trigger, children, open, onOpenChange, side = 'bottom', align = 'start', className, modal }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(popoverSurface, 'max-h-(--radix-popover-content-available-height) overflow-auto', className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
