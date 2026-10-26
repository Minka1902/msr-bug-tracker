import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { errorMessage } from '../../../lib/api';
import { useLoginTwoFactor } from '../api';
import { OneTimeCodeInput } from './OneTimeCodeInput';

interface TwoFactorStepProps {
  ticket: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function TwoFactorStep({ ticket, onSuccess, onBack }: TwoFactorStepProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    verify.mutate({ ticket, code }, { onSuccess });
  };

  const switchMode = () => {
    setRecovery((current) => !current);
    setCode('');
    verify.reset();
  };

  const verify = useLoginTwoFactor();
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const ready = recovery ? code.trim().length >= 10 : code.length === 6;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {verify.error && (
        <Banner tone="danger" icon={<CircleAlert />}>
          {errorMessage(verify.error)}
        </Banner>
      )}
      <Field
        label={recovery ? 'Recovery code' : 'Authentication code'}
        htmlFor="two-factor-code"
        hint={
          recovery
            ? 'One of the codes you saved when you turned on two-step verification. Each works once.'
            : 'Open Google Authenticator or Microsoft Authenticator and enter the 6-digit code for MSR Tracker.'
        }
      >
        <OneTimeCodeInput
          id="two-factor-code"
          value={code}
          onChange={setCode}
          recovery={recovery}
          autoFocus
          invalid={!!verify.error}
        />
      </Field>
      <Button type="submit" size="lg" block loading={verify.isPending} disabled={!ready}>
        Verify
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Button variant="link" size="sm" onClick={onBack}>
          Back to sign in
        </Button>
        <Button variant="link" size="sm" onClick={switchMode}>
          {recovery ? 'Use your authenticator app' : 'Use a recovery code'}
        </Button>
      </div>
    </form>
  );
}
