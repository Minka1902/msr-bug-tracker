import { useState, type FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loginSchema } from '@msr/shared/schemas/auth';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { safeNextPath } from '../../../lib/safeNextPath';
import { useLogin } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { TwoFactorStep } from '../components/TwoFactorStep';

export function LoginPage() {
  const submit = (event: FormEvent) =>
    form.handleSubmit((values) =>
      login.mutate(values, {
        onSuccess: (result) => ('user' in result ? goNext() : setTicket(result.ticket)),
      }),
    )(event);

  const goNext = () => navigate(safeNextPath(params.get('next')), { replace: true });

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const form = useZodForm(loginSchema, { email: '', password: '' });
  const [ticket, setTicket] = useState<string | null>(null);
  const { errors } = form.formState;

  if (ticket)
    return (
      <AuthLayout title="Two-step verification" subtitle="One more step to keep your account safe.">
        <TwoFactorStep
          ticket={ticket}
          onSuccess={goNext}
          onBack={() => {
            setTicket(null);
            login.reset();
            form.resetField('password');
          }}
        />
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {params.get('reset') && (
          <Banner tone="success">Password updated. Sign in with your new password.</Banner>
        )}
        {login.error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(login.error)}
          </Banner>
        )}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            invalid={!!errors.email}
            {...form.register('email')}
          />
        </Field>
        <Field
          label={
            <span className="flex justify-between">
              Password
              <Link to="/forgot-password" className="text-xs font-normal text-accent-text hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" size="lg" block loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
