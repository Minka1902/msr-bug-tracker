import { Dialog } from 'radix-ui';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const SIDES = {
  right: 'inset-y-0 right-0 h-full w-full sm:max-w-(--drawer-width) border-l',
  left: 'inset-y-0 left-0 h-full w-[85vw] max-w-80 border-r',
  bottom: 'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-card border-t pb-safe',
};

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: keyof typeof SIDES;
  title: string;
  children: ReactNode;
  width?: number;
  className?: string;
  modal?: boolean;
}

export function Drawer({ open, onOpenChange, side = 'right', title, children, width = 720, className, modal = true }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal && <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />}
        <Dialog.Content
          style={{ '--drawer-width': `${width}px` } as CSSProperties}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn('fixed z-50 flex flex-col overflow-hidden border-border bg-surface-raised shadow-pop outline-none pt-safe', SIDES[side], className)}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
