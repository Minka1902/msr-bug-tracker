import { Monitor, Moon, PanelLeft, PanelsLeftBottom, Sparkles, Square, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';

export function AppearanceMenu() {
  const { style, mode, nav, resolvedMode, setTheme } = useTheme();

  return (
    <Menu
      trigger={<IconButton icon={resolvedMode === 'dark' ? <Moon /> : <Sun />} label="Appearance" size="md" />}
      items={[
        { type: 'label', label: 'Mode' },
        { label: 'Light', icon: <Sun />, checked: mode === 'light', onSelect: () => setTheme({ mode: 'light' }) },
        { label: 'Dark', icon: <Moon />, checked: mode === 'dark', onSelect: () => setTheme({ mode: 'dark' }) },
        { label: 'System', icon: <Monitor />, checked: mode === 'system', onSelect: () => setTheme({ mode: 'system' }) },
        { type: 'separator' },
        { type: 'label', label: 'Style' },
        { label: 'Aurora', icon: <Sparkles />, checked: style === 'aurora', onSelect: () => setTheme({ style: 'aurora' }) },
        { label: 'Clean', icon: <Square />, checked: style === 'clean', onSelect: () => setTheme({ style: 'clean' }) },
        { type: 'separator' },
        { type: 'label', label: 'Navigation' },
        { label: 'Sidebar', icon: <PanelLeft />, checked: nav === 'sidebar', onSelect: () => setTheme({ nav: 'sidebar' }) },
        { label: 'Icon rail', icon: <PanelsLeftBottom />, checked: nav === 'rail', onSelect: () => setTheme({ nav: 'rail' }) },
      ]}
    />
  );
}
