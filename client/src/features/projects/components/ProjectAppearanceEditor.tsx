import { Flag, Square } from 'lucide-react';
import {
  defaultEmblem,
  DIVIDER_WIDTHS,
  EMBLEM_PATTERNS,
  EMBLEM_SHAPES,
  fitColors,
  type DividerWidth,
  type Emblem,
  type EmblemPattern,
} from '@msr/shared/emblem';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { ColorSwatchPicker } from '../../../components/ui/ColorSwatchPicker';
import { Field } from '../../../components/ui/Field';
import { IconPicker } from '../../../components/ui/IconPicker';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Switch } from '../../../components/ui/Switch';
import { VisualPicker } from '../../../components/ui/VisualPicker';
import { cn } from '../../../lib/cn';
import { PART_NAMES, PATTERN_LABELS, SHAPE_LABELS } from '../../../lib/emblemGeometry';
import { FLAG_COLORS } from '../../../lib/projectAppearance';

const PREVIEW_SIZES = ['xs', 'sm', 'lg', 'xl'] as const;
const DIVIDER_LABELS = ['None', 'Thin', 'Medium', 'Thick'];
const DIVIDER_OPTIONS = DIVIDER_WIDTHS.map((width) => ({
  value: String(width),
  label: DIVIDER_LABELS[width],
}));
const MODES = [
  { value: 'simple' as const, label: 'Simple', icon: <Square /> },
  { value: 'flag' as const, label: 'Flag', icon: <Flag /> },
];

export interface AppearanceValue {
  color: string;
  icon: string;
  emblem: Emblem | null;
}

interface ProjectAppearanceEditorProps {
  value: AppearanceValue;
  onChange: (patch: Partial<AppearanceValue>) => void;
  preview?: boolean;
  className?: string;
}

export function ProjectAppearanceEditor({
  value,
  onChange,
  preview = true,
  className,
}: ProjectAppearanceEditorProps) {
  const update = (patch: Partial<Emblem>) => emblem && onChange({ emblem: { ...emblem, ...patch } });

  const setPartColor = (index: number, next: string) =>
    update({ colors: emblem!.colors.map((current, part) => (part === index ? next : current)) });

  const thumbnail = (patch: Partial<Emblem>) => (
    <ProjectAvatar
      appearance={{ color, icon, emblem: { ...emblem!, ...patch, showIcon: false } }}
      size="sm"
    />
  );

  const { color, icon, emblem } = value;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {preview && (
        <div className="flex items-end gap-4 rounded-card border border-border bg-surface-muted/50 p-3">
          {PREVIEW_SIZES.map((size) => (
            <ProjectAvatar key={size} appearance={value} size={size} />
          ))}
        </div>
      )}
      <SegmentedControl
        block
        label="Icon style"
        value={emblem ? 'flag' : 'simple'}
        options={MODES}
        onChange={(mode) => onChange({ emblem: mode === 'flag' ? defaultEmblem(color) : null })}
      />
      <Field label="Accent color" hint={emblem && 'Dots, charts and highlights use this color.'}>
        <ColorPicker value={color} onChange={(next) => onChange({ color: next })} />
      </Field>
      {emblem && (
        <>
          <Field label="Shape">
            <VisualPicker
              label="Shape"
              value={emblem.shape}
              onChange={(shape) => update({ shape })}
              options={EMBLEM_SHAPES.map((shape) => ({
                value: shape,
                label: SHAPE_LABELS[shape],
                render: thumbnail({ shape }),
              }))}
            />
          </Field>
          <Field label="Pattern">
            <VisualPicker<EmblemPattern>
              label="Pattern"
              value={emblem.pattern}
              onChange={(pattern) => update({ pattern, colors: fitColors(emblem.colors, pattern) })}
              options={EMBLEM_PATTERNS.map((pattern) => ({
                value: pattern,
                label: PATTERN_LABELS[pattern],
                render: thumbnail({ pattern, colors: fitColors(emblem.colors, pattern) }),
              }))}
            />
          </Field>
          <Field label="Colors">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {emblem.colors.map((partColor, index) => (
                <div key={index} className="flex min-h-9 items-center gap-2.5 text-sm">
                  <ColorSwatchPicker
                    size="md"
                    colors={FLAG_COLORS}
                    value={partColor}
                    label={`${PART_NAMES[emblem.pattern][index]} color`}
                    onChange={(next) => setPartColor(index, next)}
                  />
                  {PART_NAMES[emblem.pattern][index]}
                </div>
              ))}
            </div>
          </Field>
          {emblem.pattern !== 'solid' && (
            <Field label="Dividers">
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  size="sm"
                  label="Divider width"
                  value={String(emblem.divider.width)}
                  options={DIVIDER_OPTIONS}
                  onChange={(width) =>
                    update({ divider: { ...emblem.divider, width: Number(width) as DividerWidth } })
                  }
                />
                <ColorSwatchPicker
                  size="md"
                  colors={FLAG_COLORS}
                  value={emblem.divider.color}
                  label="Divider color"
                  disabled={!emblem.divider.width}
                  onChange={(next) => update({ divider: { ...emblem.divider, color: next } })}
                />
              </div>
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={emblem.showIcon}
              onCheckedChange={(showIcon) => update({ showIcon })}
              label="Show icon"
            />
            <ColorSwatchPicker
              size="md"
              colors={FLAG_COLORS}
              value={emblem.iconColor}
              label="Icon color"
              disabled={!emblem.showIcon}
              onChange={(iconColor) => update({ iconColor })}
            />
          </div>
        </>
      )}
      {(!emblem || emblem.showIcon) && (
        <Field label="Icon">
          <IconPicker value={icon} color={color} onChange={(next) => onChange({ icon: next })} />
        </Field>
      )}
    </div>
  );
}
