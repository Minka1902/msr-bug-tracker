import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: ReactNode;
  titleHidden?: boolean;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  hideClose?: boolean;
  full?: boolean;
  className?: string;
  bodyClassName?: string;
  onCloseAutoFocus?: (event: Event) => void;
}

export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  titleHidden,
  description,
  children,
  footer,
  role = 'dialog',
  hideClose,
  full,
  className,
  bodyClassName,
  onCloseAutoFocus,
}: SheetProps) {
  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (!next) setOffset(0);
  };

  const [innerOpen, setInnerOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = usePointerDrag({
    axis: 'y',
    onMove: (next) => {
      setDragging(true);
      setOffset(Math.max(0, next));
    },
    onEnd: (distance, velocity) => {
      setDragging(false);
      if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) setOpen(false);
      else setOffset(0);
    },
  });

  return (
    <Dialog.Root open={open ?? innerOpen} onOpenChange={setOpen}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content
          role={role}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          style={offset ? { transform: `translateY(${offset}px)` } : undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-card border-t border-border bg-surface-raised shadow-pop outline-none animate-sheet-in',
            full && 'h-[92dvh]',
            !dragging && 'transition-transform duration-200',
            className,
          )}
        >
          <div {...drag} className="flex shrink-0 cursor-grab touch-none flex-col gap-2 px-4 pt-2 pb-3">
            <span aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" />
            {titleHidden && hideClose ? (
              <>
                <Dialog.Title className="sr-only">{title || 'Dialog'}</Dialog.Title>
                <Dialog.Description className="sr-only">
                  {description || title || 'Dialog'}
                </Dialog.Description>
              </>
            ) : (
              <div className="flex items-start gap-3 lefty:flex-row-reverse">
                <div className="min-w-0 flex-1">
                  <Dialog.Title
                    className={cn('font-display text-lg font-semibold', (!title || titleHidden) && 'sr-only')}
                  >
                    {title || 'Dialog'}
                  </Dialog.Title>
                  {description ? (
                    <Dialog.Description asChild>
                      <div className="mt-1 text-sm text-muted">{description}</div>
                    </Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">{title || 'Dialog'}</Dialog.Description>
                  )}
                </div>
                {!hideClose && (
                  <Dialog.Close asChild>
                    <IconButton icon={<X />} label="Close" tooltip={false} />
                  </Dialog.Close>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              'flex-1 overflow-y-auto overscroll-contain px-4 scrollbar-thin',
              footer ? 'pb-4' : 'pb-[max(env(safe-area-inset-bottom),1rem)]',
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="flex gap-2 border-t border-border bg-surface-muted/50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] lefty:flex-row-reverse [&>*]:flex-1">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
