import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { errorMessage } from '../../../lib/api';
import { OneTimeCodeInput } from '../../auth/components/OneTimeCodeInput';
import { PasswordInput } from '../../auth/components/PasswordInput';

interface TwoFactorCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  withPassword?: boolean;
  pending?: boolean;
  error?: unknown;
  onConfirm: (values: { password: string; code: string }) => void;
}

export function TwoFactorCodeDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  withPassword,
  pending,
  error,
  onConfirm,
}: TwoFactorCodeDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm({ password, code });
  };

  const close = () => {
    onOpenChange(false);
    setPassword('');
    setCode('');
    setRecovery(false);
  };

  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const ready = (!withPassword || password) && (recovery ? code.trim().length >= 10 : code.length === 6);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="two-factor-code-dialog"
            variant={tone}
            loading={pending}
            disabled={!ready}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="two-factor-code-dialog" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {!!error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(error)}
          </Banner>
        )}
        {withPassword && (
          <Field label="Password" htmlFor="two-factor-dialog-password">
            <PasswordInput
              id="two-factor-dialog-password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        )}
        <Field label={recovery ? 'Recovery code' : 'Authentication code'} htmlFor="two-factor-dialog-code">
          <OneTimeCodeInput
            id="two-factor-dialog-code"
            value={code}
            onChange={setCode}
            recovery={recovery}
            autoFocus={!withPassword}
          />
        </Field>
        <Button
          variant="link"
          size="sm"
          className="self-start"
          onClick={() => {
            setRecovery(!recovery);
            setCode('');
          }}
        >
          {recovery ? 'Use your authenticator app' : 'Use a recovery code'}
        </Button>
      </form>
    </Modal>
  );
}
