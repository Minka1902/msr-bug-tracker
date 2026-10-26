import { Hand, Monitor, Moon, PanelLeft, PanelsLeftBottom, Sparkles, Square, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';

interface AppearanceMenuProps {
  trigger?: ReactNode;
  className?: string;
}

export function AppearanceMenu({ trigger, className }: AppearanceMenuProps) {
  const { style, mode, nav, hand, resolvedMode, setTheme } = useTheme();

  return (
    <Menu
      title="Appearance"
      trigger={
        trigger ?? (
          <IconButton
            icon={resolvedMode === 'dark' ? <Moon /> : <Sun />}
            label="Appearance"
            size="md"
            className={className}
          />
        )
      }
      items={[
        { type: 'label', label: 'Mode' },
        {
          label: 'Light',
          icon: <Sun />,
          checked: mode === 'light',
          onSelect: () => setTheme({ mode: 'light' }),
        },
        {
          label: 'Dark',
          icon: <Moon />,
          checked: mode === 'dark',
          onSelect: () => setTheme({ mode: 'dark' }),
        },
        {
          label: 'System',
          icon: <Monitor />,
          checked: mode === 'system',
          onSelect: () => setTheme({ mode: 'system' }),
        },
        { type: 'separator' },
        { type: 'label', label: 'Style' },
        {
          label: 'Aurora',
          icon: <Sparkles />,
          checked: style === 'aurora',
          onSelect: () => setTheme({ style: 'aurora' }),
        },
        {
          label: 'Clean',
          icon: <Square />,
          checked: style === 'clean',
          onSelect: () => setTheme({ style: 'clean' }),
        },
        { type: 'separator' },
        { type: 'label', label: 'Navigation' },
        {
          label: 'Sidebar',
          icon: <PanelLeft />,
          checked: nav === 'sidebar',
          onSelect: () => setTheme({ nav: 'sidebar' }),
        },
        {
          label: 'Icon rail',
          icon: <PanelsLeftBottom />,
          checked: nav === 'rail',
          onSelect: () => setTheme({ nav: 'rail' }),
        },
        { type: 'separator' },
        { type: 'label', label: 'Hand' },
        {
          label: 'Right hand',
          icon: <Hand />,
          checked: hand === 'right',
          onSelect: () => setTheme({ hand: 'right' }),
        },
        {
          label: 'Left hand',
          icon: <Hand className="-scale-x-100" />,
          checked: hand === 'left',
          onSelect: () => setTheme({ hand: 'left' }),
        },
      ]}
    />
  );
}
