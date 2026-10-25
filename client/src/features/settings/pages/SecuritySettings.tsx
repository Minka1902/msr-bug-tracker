import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useDisableTwoFactor, useRegenerateRecoveryCodes, useTwoFactorStatus } from '../../auth/twoFactorApi';
import { RecoveryCodes } from '../components/RecoveryCodes';
import { SettingsSection } from '../components/SettingsSection';
import { TwoFactorCodeDialog } from '../components/TwoFactorCodeDialog';
import { TwoFactorSetupDialog } from '../components/TwoFactorSetupDialog';

type Dialog = 'setup' | 'disable' | 'regenerate' | null;

export function SecuritySettings() {
  const closeDialog = () => {
    setDialog(null);
    disable.reset();
    regenerate.reset();
  };

  const status = useTwoFactorStatus();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateRecoveryCodes();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const enabled = status.data?.enabled;

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Two-step verification"
        description="Ask for a code from Google Authenticator or Microsoft Authenticator every time you sign in, so a stolen password isn't enough."
        footer={
          status.data &&
          (enabled ? (
            <>
              <Button variant="secondary" leftIcon={<KeyRound />} onClick={() => setDialog('regenerate')}>
                New recovery codes
              </Button>
              <Button variant="danger-ghost" leftIcon={<ShieldOff />} onClick={() => setDialog('disable')}>
                Turn off
              </Button>
            </>
          ) : (
            <Button leftIcon={<ShieldCheck />} onClick={() => setDialog('setup')}>
              Turn on
            </Button>
          ))
        }
      >
        {status.isPending && <Skeleton className="h-10" />}
        {status.data && (
          <div className="flex flex-col gap-2 text-sm">
            <Badge
              tone={enabled ? 'success' : 'neutral'}
              icon={enabled ? <ShieldCheck /> : <ShieldOff />}
              label={enabled ? 'On' : 'Off'}
              className="self-start"
            />
            {enabled && (
              <p className="text-muted">
                {status.data.recoveryCodesLeft} of 10 recovery codes left.
                {status.data.recoveryCodesLeft < 3 && ' Create new ones before you run out.'}
              </p>
            )}
          </div>
        )}
      </SettingsSection>
      <TwoFactorSetupDialog open={dialog === 'setup'} onOpenChange={(open) => !open && closeDialog()} />
      <TwoFactorCodeDialog
        open={dialog === 'disable'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Turn off two-step verification?"
        description="Signing in will only need your password again."
        confirmLabel="Turn off"
        tone="danger"
        withPassword
        pending={disable.isPending}
        error={disable.error}
        onConfirm={(values) =>
          disable.mutate(values, {
            onSuccess: () => {
              closeDialog();
              toast.success('Two-step verification is off');
            },
          })
        }
      />
      <TwoFactorCodeDialog
        open={dialog === 'regenerate'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Create new recovery codes"
        description="Your old recovery codes stop working as soon as the new ones are created."
        confirmLabel="Create codes"
        pending={regenerate.isPending}
        error={regenerate.error}
        onConfirm={({ code }) =>
          regenerate.mutate(
            { code },
            {
              onSuccess: ({ recoveryCodes }) => {
                closeDialog();
                setNewCodes(recoveryCodes);
              },
            },
          )
        }
      />
      <Modal
        open={!!newCodes}
        onOpenChange={(open) => !open && setNewCodes(null)}
        title="Your new recovery codes"
        description="Save them somewhere safe. Each one signs you in once."
        footer={<Button onClick={() => setNewCodes(null)}>I saved my codes</Button>}
      >
        {newCodes && <RecoveryCodes codes={newCodes} />}
      </Modal>
    </div>
  );
}
