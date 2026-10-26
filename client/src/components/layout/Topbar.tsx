import { Plus, Search } from 'lucide-react';
import { useScrollHidden } from '../../hooks/useScrollHidden';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { KeyHint } from '../ui/KeyHint';
import { AppearanceMenu } from './AppearanceMenu';
import { Logo } from './Logo';
import type { ShellActions } from './shellTypes';

interface TopbarProps {
  actions: ShellActions;
  phone: boolean;
}

export function Topbar({ actions, phone }: TopbarProps) {
  const hidden = useScrollHidden(phone);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 px-4 pt-safe transition-transform duration-200 max-md:glass max-md:h-[calc(3.25rem+env(safe-area-inset-top))] max-md:border-b max-md:border-border md:px-6',
        hidden && '-translate-y-full',
      )}
    >
      <Logo compact className="md:hidden" />
      <button
        type="button"
        onClick={actions.onSearch}
        className="hidden h-10 w-full max-w-md tap-size cursor-pointer items-center gap-2.5 rounded-control border border-border bg-surface px-3 text-sm text-subtle shadow-xs transition-colors hover:border-border-strong md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search tasks, projects…</span>
        <KeyHint keys={['mod', 'K']} />
      </button>
      <div className="flex-1" />
      <AppearanceMenu className="max-md:hidden" />
      <Button leftIcon={<Plus />} onClick={() => actions.onQuickCreate()} className="max-md:hidden">
        New task
      </Button>
    </header>
  );
}
