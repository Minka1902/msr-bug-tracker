import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Field } from './Field';
import { Input } from './Input';
import { Modal } from './Modal';

interface TextPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  loading?: boolean;
  onSubmit: (value: string) => void;
}

export function TextPromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  maxLength = 120,
  loading,
  onSubmit,
}: TextPromptDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  const [value, setValue] = useState(initialValue);
  const [lastOpen, setLastOpen] = useState(open);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setValue(initialValue);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="text-prompt" loading={loading} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="text-prompt" onSubmit={submit} noValidate>
        <Field label={label} htmlFor="text-prompt-value">
          <Input
            id="text-prompt-value"
            autoFocus
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
