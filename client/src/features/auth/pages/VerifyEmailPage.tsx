import { CircleCheck, CircleX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { errorMessage } from '../../../lib/api';
import { useVerifyEmail } from '../api';
import { AuthLayout } from '../components/AuthLayout';

type Outcome = { state: 'pending' } | { state: 'verified' } | { state: 'failed'; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const verify = useVerifyEmail();
  const started = useRef(false);
  const token = params.get('token') ?? '';
  const [outcome, setOutcome] = useState<Outcome>(
    token ? { state: 'pending' } : { state: 'failed', message: 'This link is incomplete.' },
  );

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify.mutateAsync(token).then(
      () => setOutcome({ state: 'verified' }),
      (error: unknown) => setOutcome({ state: 'failed', message: errorMessage(error) }),
    );
  }, [token, verify]);

  return (
    <AuthLayout title="Email verification">
      {outcome.state === 'verified' && (
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
      {outcome.state === 'failed' && (
        <EmptyState
          compact
          icon={<CircleX />}
          title="We couldn't verify your email"
          description={outcome.message}
          action={
            <Button asChild variant="secondary">
              <Link to="/settings">Send a new link from Settings</Link>
            </Button>
          }
        />
      )}
      {outcome.state === 'pending' && (
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      )}
    </AuthLayout>
  );
}
