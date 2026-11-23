import { Link2, Plus, X } from 'lucide-react';
import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { parseSharedLink } from '@msr/shared/sharedLink';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { linkLabel } from '../linkLabel';

const LINK = /https?:\/\//i;

interface QuickAddItemProps {
  onAdd: (item: { name: string; quantity: string; url: string | null }) => void;
  placeholder?: string;
  quantityPlaceholder?: string;
  disabled?: boolean;
}

export function QuickAddItem({
  onAdd,
  placeholder = 'Add an item or paste a product link',
  quantityPlaceholder = 'Qty',
  disabled,
}: QuickAddItemProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const shared = LINK.test(name) ? parseSharedLink({ text: name }) : null;
    const itemName = (shared?.name ?? name).trim();
    if (!itemName) return;
    onAdd({ name: itemName, quantity: quantity.trim(), url: shared?.url ?? url });
    setName('');
    setQuantity('');
    setUrl(null);
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!LINK.test(text)) return;
    event.preventDefault();
    const shared = parseSharedLink({ text });
    setName(shared.name);
    setUrl(shared.url);
  };

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [url, setUrl] = useState<string | null>(null);

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          aria-label="Item"
          placeholder={placeholder}
          value={name}
          maxLength={LINK.test(name) ? undefined : 120}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          onPaste={paste}
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
      </div>
      {url && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Link2 className="size-3.5 shrink-0" />
          <span className="truncate">Link from {linkLabel(url)}</span>
          <IconButton icon={<X />} label="Drop the link" size="xs" onClick={() => setUrl(null)} />
        </p>
      )}
    </form>
  );
}
