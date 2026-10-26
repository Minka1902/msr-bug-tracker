import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
  bodyClassName?: string;
  hideClose?: boolean;
  role?: 'dialog' | 'alertdialog';
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
  hideClose,
  role = 'dialog',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content
          role={role}
          className={cn(
            'fixed z-50 flex max-h-[min(90dvh,860px)] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-pop outline-none',
            'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'max-md:top-auto max-md:bottom-0 max-md:w-full max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:pb-safe',
            SIZES[size],
            className,
          )}
        >
          {(title || !hideClose) && (
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div className="flex-1">
                {title ? (
                  <Dialog.Title className="font-display text-lg font-semibold">{title}</Dialog.Title>
                ) : (
                  <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                )}
                {description ? (
                  <Dialog.Description asChild>
                    <div className="mt-1 text-sm text-muted">{description}</div>
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              {!hideClose && (
                <Dialog.Close asChild>
                  <IconButton icon={<X />} label="Close" tooltip={false} />
                </Dialog.Close>
              )}
            </div>
          )}
          <div className={cn('flex-1 overflow-y-auto px-5 pb-5', bodyClassName)}>{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-muted/50 px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
