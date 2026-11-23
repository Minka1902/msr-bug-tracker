import { MailWarning } from 'lucide-react';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { useSendVerificationLink } from '../useSendVerificationLink';

export function VerifyEmailBanner({ email }: { email: string }) {
  const sendLink = useSendVerificationLink();

  return (
    <Banner
      tone="warning"
      icon={<MailWarning />}
      action={
        <Button
          size="xs"
          variant="soft"
          loading={sendLink.isPending}
          disabled={sendLink.isSuccess}
          onClick={() => sendLink.mutate(email)}
        >
          {sendLink.isSuccess ? 'Sent' : 'Send link'}
        </Button>
      }
    >
      Verify <strong>{email}</strong> to secure your account.
    </Banner>
  );
}
