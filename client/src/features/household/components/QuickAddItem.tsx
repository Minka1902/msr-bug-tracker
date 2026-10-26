import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface QuickAddItemProps {
  onAdd: (item: { name: string; quantity: string }) => void;
  placeholder?: string;
  quantityPlaceholder?: string;
  disabled?: boolean;
}

export function QuickAddItem({
  onAdd,
  placeholder = 'Add an item',
  quantityPlaceholder = 'Qty',
  disabled,
}: QuickAddItemProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), quantity: quantity.trim() });
    setName('');
    setQuantity('');
  };

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        aria-label="Item"
        placeholder={placeholder}
        value={name}
        maxLength={120}
        disabled={disabled}
        onChange={(event) => setName(event.target.value)}
        wrapperClassName="flex-1"
      />
      <Input
        aria-label="Quantity"
        placeholder={quantityPlaceholder}
        value={quantity}
        maxLength={40}
        disabled={disabled}
        onChange={(event) => setQuantity(event.target.value)}
        wrapperClassName="w-24"
      />
      <Button type="submit" leftIcon={<Plus />} disabled={disabled || !name.trim()}>
        Add
      </Button>
    </form>
  );
}
