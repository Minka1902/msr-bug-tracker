import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';
import { TabCount, tabListVariants, tabVariants, type TabsVariant } from './Tabs';

export interface TabLinkItem {
  to: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  end?: boolean;
}

interface TabLinksProps {
  items: TabLinkItem[];
  variant?: TabsVariant;
  className?: string;
}

export function TabLinks({ items, variant = 'underline', className }: TabLinksProps) {
  return (
    <nav className={cn(tabListVariants({ variant }), className)}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={tabVariants({ variant })}>
          {item.icon}
          {item.label}
          <TabCount count={item.count} />
        </NavLink>
      ))}
    </nav>
  );
}
