import type { FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { registerSchema } from '@msr/shared/schemas/auth';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useRegister } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function RegisterPage() {
  const submit = (event: FormEvent) =>
    form.handleSubmit((values) =>
      registerUser.mutate(
        { ...values, timezone: TIMEZONE },
        { onSuccess: () => navigate('/', { replace: true }) },
      ),
    )(event);

  const navigate = useNavigate();
  const registerUser = useRegister();
  const form = useZodForm(registerSchema, { name: '', email: '', password: '' });
  const { errors } = form.formState;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking projects and bugs in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {registerUser.error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(registerUser.error)}
          </Banner>
        )}
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" autoFocus invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...form.register('email')}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" size="lg" block loading={registerUser.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
