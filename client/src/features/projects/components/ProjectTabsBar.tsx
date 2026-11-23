import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocation } from 'react-router';
import { IconButton } from '../../../components/ui/IconButton';
import { TabLinks, type TabLinkItem } from '../../../components/ui/TabLinks';
import { useLocalState } from '../../../hooks/useLocalState';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PHONE } from '../../../lib/media';

const COLLAPSED_KEY = 'msr-project-tabs-collapsed';

const isCurrent = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

interface ProjectTabsBarProps {
  items: TabLinkItem[];
  label: string;
}

export function ProjectTabsBar({ items, label }: ProjectTabsBarProps) {
  const { pathname } = useLocation();
  const phone = useMediaQuery(PHONE);
  const [collapsed, setCollapsed] = useLocalState(COLLAPSED_KEY, false);

  if (!phone) return <TabLinks label={label} items={items} />;

  const current = items.find((item) => isCurrent(pathname, item.to)) ?? items[0];

  return (
    <div className="sticky top-(--topbar-h) z-20 -mx-4 flex items-center gap-1 border-b border-border px-4 glass transition-transform duration-200 max-[375px]:-mx-3 max-[375px]:px-3 topbar-hidden:-translate-y-[calc(100%+var(--topbar-h))]">
      {collapsed ? (
        <button
          type="button"
          aria-label="Show tabs"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className="flex h-10 flex-1 tap-size cursor-pointer items-center gap-1.5 text-sm font-medium text-text [&_svg]:size-4"
        >
          {current?.icon}
          {current?.label}
          <ChevronDown className="ml-auto text-muted" />
        </button>
      ) : (
        <>
          <TabLinks label={label} items={items} className="min-w-0 flex-1 border-b-0" />
          <IconButton
            icon={<ChevronUp />}
            label="Hide tabs"
            tooltip={false}
            aria-expanded
            onClick={() => setCollapsed(true)}
          />
        </>
      )}
    </div>
  );
}
