import { CircleCheck, CircleX } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { errorMessage } from '../../../lib/api';
import { useVerifyEmail } from '../api';
import { AuthLayout } from '../components/AuthLayout';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const verify = useVerifyEmail();
  const started = useRef(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  return (
    <AuthLayout title="Email verification">
      {verify.isSuccess && (
        <EmptyState
          compact
          icon={<CircleCheck />}
          title="Your email is verified"
          action={
            <Button asChild>
              <Link to="/">Go to dashboard</Link>
            </Button>
          }
        />
      )}
      {(verify.isError || !token) && (
        <EmptyState
          compact
          icon={<CircleX />}
          title="We couldn't verify your email"
          description={token ? errorMessage(verify.error) : 'This link is incomplete.'}
          action={
            <Button asChild variant="secondary">
              <Link to="/settings">Send a new link from Settings</Link>
            </Button>
          }
        />
      )}
      {verify.isPending && (
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      )}
    </AuthLayout>
  );
}
