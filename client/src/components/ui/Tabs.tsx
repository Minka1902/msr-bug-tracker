import { cva } from 'class-variance-authority';
import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type TabsVariant = 'underline' | 'pill';

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  content?: ReactNode;
  disabled?: boolean;
}

export const tabListVariants = cva('flex items-center overflow-x-auto no-scrollbar', {
  variants: {
    variant: {
      underline: 'gap-5 border-b border-border',
      pill: 'gap-1 rounded-control bg-surface-muted p-1',
    },
  },
});

export const tabVariants = cva(
  'relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-text disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        underline:
          'h-10 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full aria-[current=page]:text-text aria-[current=page]:after:bg-accent data-[state=active]:text-text data-[state=active]:after:bg-accent',
        pill: 'h-8 rounded-[calc(var(--r-control)-3px)] px-3 aria-[current=page]:bg-surface aria-[current=page]:text-text aria-[current=page]:shadow-sm data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm',
      },
    },
  },
);

export const TabCount = ({ count }: { count?: number }) =>
  count === undefined ? null : (
    <span className="rounded-full bg-surface-muted px-1.5 text-[11px] text-muted tabular-nums">{count}</span>
  );

interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  listClassName?: string;
  rightSlot?: ReactNode;
}

export function Tabs({ items, value, defaultValue, onValueChange, variant = 'underline', className, listClassName, rightSlot }: TabsProps) {
  return (
    <RadixTabs.Root value={value} defaultValue={defaultValue ?? items[0]?.value} onValueChange={onValueChange} className={className}>
      <div className="flex items-center gap-3">
        <RadixTabs.List className={cn(tabListVariants({ variant }), 'flex-1', listClassName)}>
          {items.map((item) => (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={tabVariants({ variant })}
            >
              {item.icon}
              {item.label}
              <TabCount count={item.count} />
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
        {rightSlot}
      </div>
      {items.map(
        (item) =>
          item.content !== undefined && (
            <RadixTabs.Content key={item.value} value={item.value} className="outline-none">
              {item.content}
            </RadixTabs.Content>
          ),
      )}
    </RadixTabs.Root>
  );
}
