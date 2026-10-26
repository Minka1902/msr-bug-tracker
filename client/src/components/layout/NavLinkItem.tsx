import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';
import { Tooltip } from '../ui/Tooltip';
import type { NavItem } from './navItems';

interface NavLinkItemProps {
  item: NavItem;
  variant?: 'row' | 'icon';
  onNavigate?: () => void;
}

export function NavLinkItem({ item, variant = 'row', onNavigate }: NavLinkItemProps) {
  const Icon = item.icon;

  if (variant === 'icon')
    return (
      <Tooltip content={item.label} side="right">
        <NavLink
          to={item.to}
          end={item.end}
          aria-label={item.label}
          onClick={onNavigate}
          className="flex size-10 tap-size items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-muted hover:text-text aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text"
        >
          <Icon className="size-5" />
        </NavLink>
      </Tooltip>
    );

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={cn(
        'flex h-10 tap-size items-center gap-3 rounded-control px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-text',
        'aria-[current=page]:bg-nav-active aria-[current=page]:text-nav-active-text aria-[current=page]:shadow-[0_8px_20px_-10px_var(--c-accent)] clean:aria-[current=page]:shadow-none',
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}
