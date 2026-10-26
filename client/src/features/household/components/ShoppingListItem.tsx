import { X } from 'lucide-react';
import type { ShoppingItem } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Checkbox } from '../../../components/ui/Checkbox';
import { IconButton } from '../../../components/ui/IconButton';
import { cn } from '../../../lib/cn';

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggle: (checked: boolean) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ShoppingListItem({ item, onToggle, onRemove, disabled, className }: ShoppingListItemProps) {
  return (
    <li className={cn('group flex min-h-11 items-center gap-3 px-3 py-1.5', className)}>
      <Checkbox
        checked={item.isChecked}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={item.isChecked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
      />
      <span className={cn('min-w-0 flex-1 truncate text-sm', item.isChecked && 'text-subtle line-through')}>
        {item.name}
        {item.quantity && <span className="ml-2 text-xs text-muted">{item.quantity}</span>}
      </span>
      {item.isChecked && item.checkedBy && (
        <Avatar name={item.checkedBy.name} src={item.checkedBy.avatarUrl} size="xs" />
      )}
      {onRemove && !disabled && (
        <IconButton
          icon={<X />}
          label={`Remove ${item.name}`}
          size="sm"
          onClick={onRemove}
          className="opacity-60 group-hover:opacity-100"
        />
      )}
    </li>
  );
}
