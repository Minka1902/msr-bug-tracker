import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  requireText?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmDialog({
  open,
  onResolve,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  requireText,
}: ConfirmDialogProps) {
  const resolve = (confirmed: boolean) => {
    setTyped('');
    onResolve(confirmed);
  };

  const [typed, setTyped] = useState('');

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && resolve(false)}
      size="sm"
      title={title}
      description={description}
      hideClose
      footer={
        <>
          <Button variant="secondary" onClick={() => resolve(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            disabled={!!requireText && typed !== requireText}
            onClick={() => resolve(true)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireText && (
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted">
            Type <strong className="font-mono text-text">{requireText}</strong> to confirm.
          </span>
          <Input
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-label="Confirmation text"
          />
        </div>
      )}
    </Modal>
  );
}
