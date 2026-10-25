import type { FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { Link } from 'react-router';
import { forgotPasswordSchema } from '@msr/shared/schemas/auth';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { useZodForm } from '../../../hooks/useZodForm';
import { useForgotPassword } from '../api';
import { AuthLayout } from '../components/AuthLayout';

export function ForgotPasswordPage() {
  const submit = (event: FormEvent) => form.handleSubmit(({ email }) => forgot.mutate(email))(event);

  const forgot = useForgotPassword();
  const form = useZodForm(forgotPasswordSchema, { email: '' });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-accent-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <EmptyState
          compact
          icon={<MailCheck />}
          title="Check your inbox"
          description={`If an account exists for ${form.getValues('email')}, a reset link is on its way. It expires in 1 hour.`}
        />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus {...form.register('email')} />
          </Field>
          <Button type="submit" size="lg" block loading={forgot.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
