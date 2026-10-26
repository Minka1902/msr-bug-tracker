import { DropdownMenu } from 'radix-ui';
import { Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';
import { PHONE } from '../../lib/media';
import { popoverSurface } from './Popover';
import { Sheet } from './Sheet';

export type MenuItem =
  | {
      type?: 'item';
      label: ReactNode;
      icon?: ReactNode;
      shortcut?: string;
      onSelect?: () => void;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
      hidden?: boolean;
    }
  | { type: 'separator'; hidden?: boolean }
  | { type: 'label'; label: ReactNode; hidden?: boolean };

interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  title?: string;
  onCloseAutoFocus?: (event: Event) => void;
}

const itemClass =
  'flex h-8.5 pointer-coarse:h-(--tap) cursor-pointer items-center gap-2.5 rounded-[calc(var(--r-control)-4px)] px-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted';

export function Menu({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  className,
  title,
  onCloseAutoFocus,
}: MenuProps) {
  const phone = useMediaQuery(PHONE);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (phone)
    return (
      <Sheet
        trigger={trigger}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={title}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div role="menu" aria-label={title} className="flex flex-col">
          {items.map((item, index) => {
            if (item.hidden) return null;
            if (item.type === 'separator')
              return <div key={index} role="separator" className="my-1 h-px bg-border" />;
            if (item.type === 'label')
              return (
                <p key={index} className="px-2 pt-2 pb-1 text-xs font-medium text-subtle">
                  {item.label}
                </p>
              );
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setSheetOpen(false);
                  item.onSelect?.();
                }}
                className={cn(
                  itemClass,
                  'min-h-(--tap) w-full text-left text-base active:bg-surface-muted',
                  item.danger && 'text-danger [&_svg]:text-danger',
                )}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.checked && <Check className="text-accent-text!" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(popoverSurface, 'min-w-48 p-1', className)}
        >
          {items.map((item, index) => {
            if (item.hidden) return null;
            if (item.type === 'separator')
              return <DropdownMenu.Separator key={index} className="my-1 h-px bg-border" />;
            if (item.type === 'label')
              return (
                <DropdownMenu.Label key={index} className="px-2 pt-1.5 pb-1 text-xs font-medium text-subtle">
                  {item.label}
                </DropdownMenu.Label>
              );
            return (
              <DropdownMenu.Item
                key={index}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(itemClass, item.danger && 'text-danger [&_svg]:text-danger')}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.checked && <Check className="text-accent-text!" />}
                {item.shortcut && <kbd className="font-sans text-xs text-subtle">{item.shortcut}</kbd>}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
