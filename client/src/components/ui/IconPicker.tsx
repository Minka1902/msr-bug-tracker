import { PROJECT_ICONS } from '../../lib/projectAppearance';
import { VisualPicker } from './VisualPicker';

const OPTIONS = Object.entries(PROJECT_ICONS).map(([name, Icon]) => ({
  value: name,
  label: name,
  render: <Icon className="size-4.5" />,
}));

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
  className?: string;
}

export function IconPicker({ value, onChange, color, className }: IconPickerProps) {
  return (
    <VisualPicker
      label="Icon"
      value={value}
      options={OPTIONS}
      onChange={onChange}
      color={color}
      className={className}
    />
  );
}
