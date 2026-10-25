import { Menu as MenuIcon, Plus, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { KeyHint } from '../ui/KeyHint';
import { AppearanceMenu } from './AppearanceMenu';
import { Logo } from './Logo';
import type { ShellActions } from './shellTypes';

interface TopbarProps {
  actions: ShellActions;
  onOpenMenu: () => void;
}

export function Topbar({ actions, onOpenMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 px-4 pt-safe max-md:glass max-md:h-[calc(3.5rem+env(safe-area-inset-top))] max-md:border-b max-md:border-border md:px-6">
      <IconButton
        icon={<MenuIcon />}
        label="Open menu"
        size="md"
        onClick={onOpenMenu}
        className="md:hidden"
        tooltip={false}
      />
      <Logo compact className="md:hidden" />
      <button
        type="button"
        onClick={actions.onSearch}
        className="hidden h-10 w-full max-w-md cursor-pointer items-center gap-2.5 rounded-control border border-border bg-surface px-3 text-sm text-subtle shadow-xs transition-colors hover:border-border-strong md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search tasks, projects…</span>
        <KeyHint keys={['mod', 'K']} />
      </button>
      <div className="flex-1" />
      <IconButton
        icon={<Search />}
        label="Search"
        size="md"
        onClick={actions.onSearch}
        className="md:hidden"
        tooltip={false}
      />
      <AppearanceMenu />
      <Button leftIcon={<Plus />} onClick={actions.onQuickCreate} className="max-md:hidden">
        New task
      </Button>
    </header>
  );
}
