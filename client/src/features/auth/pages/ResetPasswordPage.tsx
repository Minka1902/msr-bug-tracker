import type { FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { passwordSchema } from '@msr/shared/schemas/auth';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useResetPassword } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

export function ResetPasswordPage() {
  const submit = (event: FormEvent) =>
    form.handleSubmit(({ password }) =>
      reset.mutate({ token, password }, { onSuccess: () => navigate('/login?reset=1', { replace: true }) }),
    )(event);

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const form = useZodForm(schema, { password: '', confirm: '' });
  const token = params.get('token') ?? '';
  const { errors } = form.formState;

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <Link to="/forgot-password" className="font-medium text-accent-text hover:underline">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {(reset.error || !token) && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {token ? errorMessage(reset.error) : 'This reset link is incomplete.'}
          </Banner>
        )}
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            invalid={!!errors.password}
            {...form.register('password')}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            invalid={!!errors.confirm}
            {...form.register('confirm')}
          />
        </Field>
        <Button type="submit" size="lg" block disabled={!token} loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
