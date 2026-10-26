import { Command } from 'cmdk';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Popover as RadixPopover } from 'radix-ui';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';
import { PHONE } from '../../lib/media';
import { popoverSurface } from './Popover';
import { Sheet } from './Sheet';
import { Tooltip } from './Tooltip';

export interface PickerOption<V extends string = string> {
  value: V;
  label: string;
  icon?: ReactNode;
  color?: string;
  description?: string;
  keywords?: string[];
  group?: string;
  disabled?: boolean;
}

interface BaseProps<V extends string> {
  options: PickerOption<V>[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  disabledReason?: string;
  searchable?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
  contentClassName?: string;
  renderOption?: (option: PickerOption<V>) => ReactNode;
  renderTrigger?: (selected: PickerOption<V>[]) => ReactNode;
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  'aria-label'?: string;
}

interface SingleProps<V extends string> extends BaseProps<V> {
  multiple?: false;
  value: V | null;
  onChange: (value: V | null) => void;
  clearable?: boolean;
}

interface MultiProps<V extends string> extends BaseProps<V> {
  multiple: true;
  value: V[];
  onChange: (value: V[]) => void;
  clearable?: boolean;
}

export type OptionPickerProps<V extends string> = SingleProps<V> | MultiProps<V>;

export const OptionDot = ({ color }: { color?: string }) =>
  color ? (
    <span style={{ '--c': color } as CSSProperties} className="size-2.5 shrink-0 rounded-full bg-(--c)" />
  ) : null;

const defaultRenderOption = <V extends string>(option: PickerOption<V>) => (
  <>
    {option.icon ?? <OptionDot color={option.color} />}
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{option.label}</span>
      {option.description && <span className="truncate text-xs text-muted">{option.description}</span>}
    </span>
  </>
);

export function OptionPicker<V extends string>(props: OptionPickerProps<V>) {
  const {
    options,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No results',
    disabled,
    disabledReason,
    searchable = options.length > 6,
    align = 'start',
    className,
    contentClassName,
    renderOption = defaultRenderOption,
    renderTrigger,
    onCreate,
    createLabel = (text: string) => `Create “${text}”`,
  } = props;
  const selectedValues = props.multiple ? props.value : props.value === null ? [] : [props.value];
  const selected = options.filter((option) => selectedValues.includes(option.value));
  const groups = [...new Set(options.map((option) => option.group ?? ''))];

  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInnerOpen(next);
    props.onOpenChange?.(next);
    if (!next) setQuery('');
  };

  const toggle = (value: V) => {
    if (props.multiple) {
      props.onChange(
        selectedValues.includes(value)
          ? props.value.filter((item) => item !== value)
          : [...props.value, value],
      );
      return;
    }
    props.onChange(props.clearable && props.value === value ? null : value);
    setOpen(false);
  };

  const create = () => {
    onCreate?.(query.trim());
    setOpen(false);
  };

  const phone = useMediaQuery(PHONE);
  const [innerOpen, setInnerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const open = props.open ?? innerOpen;

  const trigger = renderTrigger ? (
    renderTrigger(selected)
  ) : (
    <button
      type="button"
      disabled={disabled}
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex h-9.5 min-w-0 cursor-pointer items-center tap-size gap-2 rounded-control border border-border bg-surface px-3 text-sm transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {selected.length === 0 && <span className="flex-1 truncate text-left text-subtle">{placeholder}</span>}
      {selected.length === 1 && (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selected[0]!.icon ?? <OptionDot color={selected[0]!.color} />}
          <span className="truncate">{selected[0]!.label}</span>
        </span>
      )}
      {selected.length > 1 && <span className="flex-1 truncate text-left">{selected.length} selected</span>}
      <ChevronDown className="size-4 shrink-0 text-subtle" />
    </button>
  );

  if (disabled) return <Tooltip content={disabledReason}>{trigger}</Tooltip>;

  const body = (
    <Command loop>
      {searchable && (
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={searchPlaceholder}
          className="h-10 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-subtle pointer-coarse:h-(--tap)"
        />
      )}
      <Command.List className={cn('overflow-y-auto p-1 scrollbar-thin', !phone && 'max-h-72')}>
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">{emptyText}</Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group}
            heading={group || undefined}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-subtle"
          >
            {options
              .filter((option) => (option.group ?? '') === group)
              .map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => toggle(option.value)}
                  className="flex min-h-8.5 cursor-pointer items-center gap-2.5 rounded-[calc(var(--r-control)-4px)] px-2 py-1 text-sm outline-none pointer-coarse:min-h-(--tap) data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-muted [&_svg]:size-4"
                >
                  {renderOption(option)}
                  {selectedValues.includes(option.value) && <Check className="shrink-0 text-accent-text" />}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
        {onCreate && query.trim() && (
          <Command.Item
            value={`__create__${query}`}
            onSelect={create}
            className="flex min-h-8.5 cursor-pointer items-center gap-2.5 rounded-[calc(var(--r-control)-4px)] px-2 text-sm text-accent-text outline-none pointer-coarse:min-h-(--tap) data-[selected=true]:bg-surface-muted [&_svg]:size-4"
          >
            <Plus />
            {createLabel(query.trim())}
          </Command.Item>
        )}
      </Command.List>
    </Command>
  );

  if (phone)
    return (
      <Sheet
        trigger={trigger}
        open={open}
        onOpenChange={setOpen}
        title={props['aria-label'] ?? placeholder}
        bodyClassName="px-2"
      >
        {body}
      </Sheet>
    );

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onClick={(event) => event.stopPropagation()}
          className={cn(popoverSurface, 'w-64 overflow-hidden p-0', contentClassName)}
        >
          {body}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
