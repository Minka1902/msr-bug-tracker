import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
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
  label: string;
  variant?: TabsVariant;
  className?: string;
}

export function TabLinks({ items, label, variant = 'underline', className }: TabLinksProps) {
  const list = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [pathname]);

  return (
    <nav ref={list} aria-label={label} className={cn(tabListVariants({ variant }), 'snap-x', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={cn(tabVariants({ variant }), 'snap-start')}
        >
          {item.icon}
          {item.label}
          <TabCount count={item.count} />
        </NavLink>
      ))}
    </nav>
  );
}
