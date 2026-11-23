import { Search, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { PROJECT_ICON_CATEGORIES } from '../../lib/projectIcons';
import { Input } from './Input';
import { tabListVariants, tabVariants } from './Tabs';
import { VisualPicker } from './VisualPicker';

const toOptions = (icons: Record<string, LucideIcon>) =>
  Object.entries(icons).map(([name, Icon]) => ({
    value: name,
    label: name,
    render: <Icon className="size-4.5" />,
  }));

const CATEGORIES = PROJECT_ICON_CATEGORIES.map((category) => ({
  ...category,
  options: toOptions(category.icons),
}));
const ALL_OPTIONS = CATEGORIES.flatMap((category) => category.options);

const categoryOf = (icon: string) =>
  (CATEGORIES.find((category) => icon in category.icons) ?? CATEGORIES[0]!).id;

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
  className?: string;
}

export function IconPicker({ value, onChange, color, className }: IconPickerProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(() => categoryOf(value));

  const search = query.trim().toLowerCase().replace(/\s+/g, '-');
  const options = search
    ? ALL_OPTIONS.filter((option) => option.value.includes(search))
    : CATEGORIES.find((category) => category.id === categoryId)!.options;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Input
        type="search"
        aria-label="Search icons"
        placeholder="Search icons"
        leftIcon={<Search />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!search && (
        <div role="group" aria-label="Icon categories" className={tabListVariants({ variant: 'pill' })}>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={category.id === categoryId}
              data-state={category.id === categoryId ? 'active' : 'inactive'}
              onClick={() => setCategoryId(category.id)}
              className={tabVariants({ variant: 'pill' })}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}
      {options.length ? (
        <VisualPicker label="Icon" value={value} options={options} onChange={onChange} color={color} />
      ) : (
        <p className="py-2 text-sm text-muted">No icons match "{query.trim()}"</p>
      )}
    </div>
  );
}
