import { CircleAlert, KeyRound, ScanLine, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { QrCode } from '../../../components/ui/QrCode';
import { errorMessage } from '../../../lib/api';
import { OneTimeCodeInput } from '../../auth/components/OneTimeCodeInput';
import { PasswordInput } from '../../auth/components/PasswordInput';
import { useEnableTwoFactor, useStartTwoFactor } from '../../auth/twoFactorApi';
import { RecoveryCodes } from './RecoveryCodes';
import { StepList } from './StepList';

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCAN_STEPS = [
  { icon: <KeyRound />, text: 'Install Google Authenticator or Microsoft Authenticator on your phone.' },
  { icon: <ScanLine />, text: 'Tap + (Add account), choose “Scan a QR code” and scan the code below.' },
  { icon: <ShieldCheck />, text: 'Enter the 6-digit code the app shows to finish.' },
];

export function TwoFactorSetupDialog({ open, onOpenChange }: TwoFactorSetupDialogProps) {
  const close = () => {
    onOpenChange(false);
    setPassword('');
    setCode('');
    start.reset();
    enable.reset();
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    start.mutate(password);
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    enable.mutate(code, { onSuccess: () => toast.success('Two-step verification is on') });
  };

  const start = useStartTwoFactor();
  const enable = useEnableTwoFactor();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const error = start.error ?? enable.error;
  const step = enable.data ? 'codes' : start.data ? 'scan' : 'password';

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Turn on two-step verification"
      description={
        step === 'codes'
          ? 'Save these recovery codes somewhere safe. Each one signs you in once if you lose your phone.'
          : 'You will be asked for a code from your authenticator app every time you sign in.'
      }
      footer={
        step === 'codes' ? (
          <Button onClick={close}>I saved my codes</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="two-factor-setup"
              loading={start.isPending || enable.isPending}
              disabled={step === 'password' ? !password : code.length !== 6}
            >
              {step === 'password' ? 'Continue' : 'Turn on'}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(error)}
          </Banner>
        )}
        {step === 'password' && (
          <form id="two-factor-setup" onSubmit={submitPassword} noValidate>
            <Field label="Confirm your password" htmlFor="two-factor-password">
              <PasswordInput
                id="two-factor-password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </form>
        )}
        {step === 'scan' && start.data && (
          <form id="two-factor-setup" onSubmit={submitCode} className="flex flex-col gap-5" noValidate>
            <StepList steps={SCAN_STEPS} />
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <QrCode value={start.data.otpauthUrl} size={176} title="Authenticator setup QR code" />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Field label="Can't scan? Enter this key instead" htmlFor="two-factor-secret">
                  <code
                    id="two-factor-secret"
                    className="block rounded-control border border-border bg-surface-muted/60 px-3 py-2 font-mono text-sm break-all select-all"
                  >
                    {start.data.secret.match(/.{1,4}/g)?.join(' ')}
                  </code>
                </Field>
                <Field label="6-digit code" htmlFor="two-factor-confirm">
                  <OneTimeCodeInput
                    id="two-factor-confirm"
                    value={code}
                    onChange={setCode}
                    autoFocus
                    invalid={!!enable.error}
                  />
                </Field>
              </div>
            </div>
          </form>
        )}
        {step === 'codes' && enable.data && <RecoveryCodes codes={enable.data.recoveryCodes} />}
      </div>
    </Modal>
  );
}
