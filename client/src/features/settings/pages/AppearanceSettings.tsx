import {
  Hand,
  Monitor,
  Moon,
  PanelLeft,
  PanelsLeftBottom,
  Pointer,
  Sparkles,
  Square,
  Sun,
  ZoomIn,
} from 'lucide-react';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { useTheme } from '../../../hooks/useTheme';
import { SettingsSection } from '../components/SettingsSection';
import { PhonePreview } from '../components/PhonePreview';
import { ThemePreview } from '../components/ThemePreview';

export function AppearanceSettings() {
  const { style, mode, nav, hand, touch, resolvedMode, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection title="Style" description="Aurora is glassy and colorful. Clean is flat and minimal.">
        <ChoiceGroup
          label="Style"
          columns={2}
          value={style}
          onChange={(value) => setTheme({ style: value })}
          choices={[
            {
              value: 'aurora',
              label: 'Aurora',
              icon: <Sparkles />,
              preview: <ThemePreview style="aurora" mode={resolvedMode} nav={nav} />,
            },
            {
              value: 'clean',
              label: 'Clean',
              icon: <Square />,
              preview: <ThemePreview style="clean" mode={resolvedMode} nav={nav} />,
            },
          ]}
        />
      </SettingsSection>
      <SettingsSection title="Mode" description="System follows your device setting.">
        <ChoiceGroup
          label="Mode"
          value={mode}
          onChange={(value) => setTheme({ mode: value })}
          choices={[
            {
              value: 'light',
              label: 'Light',
              icon: <Sun />,
              preview: <ThemePreview style={style} mode="light" nav={nav} />,
            },
            {
              value: 'dark',
              label: 'Dark',
              icon: <Moon />,
              preview: <ThemePreview style={style} mode="dark" nav={nav} />,
            },
            {
              value: 'system',
              label: 'System',
              icon: <Monitor />,
              preview: (
                <div className="grid grid-cols-2 overflow-hidden rounded-[10px]">
                  <ThemePreview style={style} mode="light" nav={nav} className="rounded-none" />
                  <ThemePreview style={style} mode="dark" nav={nav} className="rounded-none" />
                </div>
              ),
            },
          ]}
        />
      </SettingsSection>
      <SettingsSection
        title="Navigation"
        description="A full sidebar, or a slim icon rail with a project panel."
      >
        <ChoiceGroup
          label="Navigation"
          columns={2}
          value={nav}
          onChange={(value) => setTheme({ nav: value })}
          choices={[
            {
              value: 'sidebar',
              label: 'Sidebar',
              icon: <PanelLeft />,
              preview: <ThemePreview style={style} mode={resolvedMode} nav="sidebar" />,
            },
            {
              value: 'rail',
              label: 'Icon rail',
              icon: <PanelsLeftBottom />,
              preview: <ThemePreview style={style} mode={resolvedMode} nav="rail" />,
            },
          ]}
        />
      </SettingsSection>
      <SettingsSection
        title="Phone & tablet"
        description="Put the + button, sheet buttons and swipe actions under the thumb you use, and pick how big buttons are on touch screens."
      >
        <div className="flex flex-col gap-4">
          <ChoiceGroup
            label="Hand"
            columns={2}
            value={hand}
            onChange={(value) => setTheme({ hand: value })}
            choices={[
              {
                value: 'right',
                label: 'Right hand',
                description: 'Swipe left to finish a task',
                icon: <Hand />,
                preview: <PhonePreview hand="right" touch={touch} />,
              },
              {
                value: 'left',
                label: 'Left hand',
                description: 'Swipe right to finish a task',
                icon: <Hand className="-scale-x-100" />,
                preview: <PhonePreview hand="left" touch={touch} />,
              },
            ]}
          />
          <ChoiceGroup
            label="Touch size"
            columns={2}
            value={touch}
            onChange={(value) => setTheme({ touch: value })}
            choices={[
              {
                value: 'standard',
                label: 'Standard',
                description: '44 px targets',
                icon: <Pointer />,
                preview: <PhonePreview hand={hand} touch="standard" />,
              },
              {
                value: 'large',
                label: 'Large',
                description: '52 px targets and bigger text',
                icon: <ZoomIn />,
                preview: <PhonePreview hand={hand} touch="large" />,
              },
            ]}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
