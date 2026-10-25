import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { CurrentUser } from '@msr/shared/types';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../lib/api';
import { useStopImpersonating } from './api';

export function ImpersonationBanner({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const stop = useStopImpersonating();

  return (
    <Banner
      tone="violet"
      icon={<Eye />}
      action={
        <Button
          size="xs"
          variant="soft"
          loading={stop.isPending}
          onClick={() =>
            stop.mutate(undefined, {
              onSuccess: () => navigate('/settings/demo'),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        >
          Return to my account
        </Button>
      }
    >
      Viewing as <strong>{user.name}</strong>, a demo teammate of {user.impersonator!.name}. You see exactly
      what their role allows.
    </Banner>
  );
}
