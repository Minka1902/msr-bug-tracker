import { CircleAlert, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { icloudConnectSchema } from '@msr/shared/schemas/calendar';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useConnectICloud } from '../api';

interface ICloudConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APP_PASSWORD_URL = 'https://account.apple.com/account/manage';

export function ICloudConnectDialog({ open, onOpenChange }: ICloudConnectDialogProps) {
  const close = () => {
    onOpenChange(false);
    form.reset();
    connect.reset();
  };

  const connect = useConnectICloud();
  const form = useZodForm(icloudConnectSchema, { appleId: '', appPassword: '' });
  const { errors } = form.formState;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Connect iCloud Calendar"
      description="Your iPhone, iPad and Mac calendars, synced both ways."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="icloud-connect" loading={connect.isPending}>
            Connect
          </Button>
        </>
      }
    >
      <form
        id="icloud-connect"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          connect.mutate(values, {
            onSuccess: () => {
              toast.success('iCloud Calendar connected');
              close();
            },
          }),
        )}
      >
        {connect.error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(connect.error)}
          </Banner>
        )}
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          <li>
            Sign in at{' '}
            <a
              href={APP_PASSWORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-accent-text hover:underline"
            >
              account.apple.com <ExternalLink className="size-3" aria-hidden />
            </a>
            .
          </li>
          <li>Open Sign-In and Security → App-Specific Passwords and create one called “MSR Tracker”.</li>
          <li>Paste it below. Your normal Apple password is never needed.</li>
        </ol>
        <Field label="Apple Account email" htmlFor="icloud-apple-id" error={errors.appleId?.message}>
          <Input
            id="icloud-apple-id"
            type="email"
            autoComplete="username"
            invalid={!!errors.appleId}
            {...form.register('appleId')}
          />
        </Field>
        <Field label="App-specific password" htmlFor="icloud-password" error={errors.appPassword?.message}>
          <Input
            id="icloud-password"
            autoComplete="off"
            placeholder="abcd-efgh-ijkl-mnop"
            className="font-mono"
            invalid={!!errors.appPassword}
            {...form.register('appPassword')}
          />
        </Field>
      </form>
    </Modal>
  );
}
