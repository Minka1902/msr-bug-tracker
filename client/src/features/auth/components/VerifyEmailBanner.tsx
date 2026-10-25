import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { errorMessage } from '../../../lib/api';
import { useResendVerification } from '../api';

export function VerifyEmailBanner({ email }: { email: string }) {
  const resend = useResendVerification();

  return (
    <Banner
      tone="warning"
      icon={<MailWarning />}
      action={
        <Button
          size="xs"
          variant="soft"
          loading={resend.isPending}
          disabled={resend.isSuccess}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => toast.success(`Verification email sent to ${email}`),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        >
          {resend.isSuccess ? 'Sent' : 'Resend link'}
        </Button>
      }
    >
      Verify <strong>{email}</strong> to secure your account.
    </Banner>
  );
}
