import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Field } from './Field';
import { Input } from './Input';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

export interface TextPromptOptions {
  title: string;
  label: string;
  description?: ReactNode;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  multiline?: boolean;
}

interface TextPromptDialogProps extends TextPromptOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onSubmit: (value: string) => void;
}

export function TextPromptDialog({
  open,
  onOpenChange,
  title,
  label,
  description,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  maxLength = 120,
  multiline,
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

  const fieldProps = { id: 'text-prompt-value', autoFocus: true, value, maxLength, placeholder };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="submit" form="text-prompt" loading={loading} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="text-prompt" onSubmit={submit} noValidate>
        <Field label={label} htmlFor="text-prompt-value">
          {multiline ? (
            <Textarea {...fieldProps} rows={4} onChange={(event) => setValue(event.target.value)} />
          ) : (
            <Input {...fieldProps} onChange={(event) => setValue(event.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  );
}
