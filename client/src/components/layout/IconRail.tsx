import { LogOut, PanelLeftOpen, Search } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { Logo } from './Logo';
import { NavLinkItem } from './NavLinkItem';
import { SYSTEM_NAV, WORKSPACE_NAV } from './navItems';
import type { ShellActions, ShellUser } from './shellTypes';

interface IconRailProps {
  user: ShellUser;
  actions: ShellActions;
  onTogglePanel?: () => void;
  panelOpen?: boolean;
}

export function IconRail({ user, actions, onTogglePanel, panelOpen }: IconRailProps) {
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3 aurora:glass aurora:border-white/40 aurora:dark:border-white/5">
      <Logo compact className="mb-3" />
      {onTogglePanel && !panelOpen && <IconButton icon={<PanelLeftOpen />} label="Expand navigation" onClick={onTogglePanel} tooltipSide="right" />}
      {WORKSPACE_NAV.map((item) => (
        <NavLinkItem key={item.to} item={item} variant="icon" />
      ))}
      <IconButton icon={<Search />} label="Search" size="md" onClick={actions.onSearch} tooltipSide="right" className="size-10 [&_svg]:size-5" />
      <div className="flex-1" />
      {SYSTEM_NAV.map((item) => (
        <NavLinkItem key={item.to} item={item} variant="icon" />
      ))}
      <Menu
        side="right"
        align="end"
        trigger={
          <button type="button" aria-label="Account" className="cursor-pointer rounded-full">
            <Avatar name={user.name} src={user.avatarUrl} size="md" />
          </button>
        }
        items={[
          { type: 'label', label: user.email },
          { label: 'Log out', icon: <LogOut />, onSelect: actions.onLogout },
        ]}
      />
    </aside>
  );
}
