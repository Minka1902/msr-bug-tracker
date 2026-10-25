import { CalendarRange, ListFilter, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { Input } from './Input';
import { Menu } from './Menu';
import { OptionPicker, type PickerOption } from './OptionPicker';
import { Popover } from './Popover';

export type FilterDef =
  | { key: string; label: string; icon?: ReactNode; type: 'multi'; options: PickerOption[] }
  | { key: string; label: string; icon?: ReactNode; type: 'toggle' }
  | { key: string; toKey: string; label: string; icon?: ReactNode; type: 'dateRange' };

interface FilterBarProps {
  defs: FilterDef[];
  values: Record<string, string | undefined>;
  onChange: (patch: Record<string, string | string[] | null>) => void;
  onClear: () => void;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  children?: ReactNode;
  className?: string;
}

const chipClass =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft pr-1 pl-3 text-sm text-accent-text [&_svg]:size-3.5';

const isActive = (def: FilterDef, values: FilterBarProps['values']) =>
  !!values[def.key] || (def.type === 'dateRange' && !!values[def.toKey]);

export function FilterBar({ defs, values, onChange, onClear, search, children, className }: FilterBarProps) {
  const summary = (def: FilterDef) => {
    if (def.type === 'toggle') return def.label;
    if (def.type === 'dateRange')
      return `${def.label}: ${values[def.key] ?? '…'} → ${values[def.toKey] ?? '…'}`;
    const selected = (values[def.key] ?? '').split(',').filter(Boolean);
    const names = def.options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
    return `${def.label}: ${names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ') || 'any'}`;
  };

  const remove = (def: FilterDef) =>
    onChange(def.type === 'dateRange' ? { [def.key]: null, [def.toKey]: null } : { [def.key]: null });

  const [openKey, setOpenKey] = useState<string | null>(null);
  const visible = defs.filter((def) => isActive(def, values) || def.key === openKey);
  const available = defs.filter((def) => !isActive(def, values));

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {search && (
        <Input
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder ?? 'Search'}
          leftIcon={<Search />}
          size="sm"
          wrapperClassName="w-full sm:w-56"
        />
      )}
      {visible.map((def) => {
        const close = (
          <span
            role="button"
            aria-label={`Remove ${def.label} filter`}
            onClick={(event) => {
              event.stopPropagation();
              remove(def);
              setOpenKey(null);
            }}
            className="flex size-6 items-center justify-center rounded-full hover:bg-accent/15"
          >
            <X />
          </span>
        );
        if (def.type === 'toggle')
          return (
            <span key={def.key} className={chipClass}>
              {def.icon}
              {def.label}
              {close}
            </span>
          );
        if (def.type === 'dateRange')
          return (
            <Popover
              key={def.key}
              open={openKey === def.key || undefined}
              onOpenChange={(open) => setOpenKey(open ? def.key : null)}
              trigger={
                <button type="button" className={chipClass}>
                  {def.icon ?? <CalendarRange />}
                  {summary(def)}
                  {close}
                </button>
              }
              className="flex w-64 flex-col gap-2 p-3"
            >
              <label className="flex flex-col gap-1 text-xs text-muted">
                From
                <Input
                  type="date"
                  size="sm"
                  value={values[def.key] ?? ''}
                  onChange={(event) => onChange({ [def.key]: event.target.value || null })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                To
                <Input
                  type="date"
                  size="sm"
                  value={values[def.toKey] ?? ''}
                  onChange={(event) => onChange({ [def.toKey]: event.target.value || null })}
                />
              </label>
            </Popover>
          );
        return (
          <OptionPicker
            key={def.key}
            multiple
            searchable
            open={openKey === def.key || undefined}
            onOpenChange={(open) => setOpenKey(open ? def.key : null)}
            value={(values[def.key] ?? '').split(',').filter(Boolean)}
            onChange={(next) => onChange({ [def.key]: next })}
            options={def.options}
            renderTrigger={() => (
              <button type="button" className={chipClass}>
                {def.icon}
                <span className="max-w-60 truncate">{summary(def)}</span>
                {close}
              </button>
            )}
          />
        );
      })}
      {available.length > 0 && (
        <Menu
          align="start"
          trigger={
            <Button variant="ghost" size="sm" leftIcon={<ListFilter />}>
              Filter
            </Button>
          }
          items={available.map((def) => ({
            label: def.label,
            icon: def.icon,
            onSelect: () =>
              def.type === 'toggle'
                ? onChange({ [def.key]: 'true' })
                : setTimeout(() => setOpenKey(def.key), 0),
          }))}
        />
      )}
      {defs.some((def) => isActive(def, values)) && (
        <Button variant="link" size="sm" onClick={onClear}>
          Clear all
        </Button>
      )}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
