import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { changeEmailSchema, passwordSchema } from '@msr/shared/schemas/auth';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useChangeEmail, useChangePassword } from '../../auth/api';
import { PasswordInput } from '../../auth/components/PasswordInput';
import { SettingsSection } from '../components/SettingsSection';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

export function AccountSettings() {
  const submitEmail = (event: FormEvent) =>
    emailForm.handleSubmit((values) =>
      changeEmail.mutate(values, {
        onSuccess: () => {
          emailForm.reset({ email: values.email, password: '' });
          toast.success(`Email changed. Check ${values.email} to verify it.`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }),
    )(event);

  const submitPassword = (event: FormEvent) =>
    passwordForm.handleSubmit(({ currentPassword, newPassword }) =>
      changePassword.mutate(
        { currentPassword, newPassword },
        {
          onSuccess: () => {
            passwordForm.reset();
            toast.success('Password updated. Other devices were signed out.');
          },
          onError: (error) => toast.error(errorMessage(error)),
        },
      ),
    )(event);

  const user = useCurrentUser();
  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();
  const emailForm = useZodForm(changeEmailSchema, { email: user.email, password: '' });
  const passwordForm = useZodForm(passwordFormSchema, { currentPassword: '', newPassword: '', confirm: '' });

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitEmail} noValidate>
        <SettingsSection
          title="Email"
          description={
            <span className="flex flex-col items-start gap-2">
              Changing it requires verifying the new address.
              <Badge
                tone={user.emailVerified ? 'success' : 'warning'}
                label={user.emailVerified ? 'Verified' : 'Not verified'}
              />
            </span>
          }
          footer={
            <Button type="submit" loading={changeEmail.isPending}>
              Change email
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email" error={emailForm.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" {...emailForm.register('email')} />
            </Field>
            <Field
              label="Current password"
              htmlFor="email-password"
              error={emailForm.formState.errors.password?.message}
            >
              <PasswordInput
                id="email-password"
                autoComplete="current-password"
                {...emailForm.register('password')}
              />
            </Field>
          </div>
        </SettingsSection>
      </form>
      <form onSubmit={submitPassword} noValidate>
        <SettingsSection
          title="Password"
          description="Updating your password signs you out everywhere else."
          footer={
            <Button type="submit" loading={changePassword.isPending}>
              Update password
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Field
              label="Current password"
              htmlFor="current-password"
              error={passwordForm.formState.errors.currentPassword?.message}
            >
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
            </Field>
            <Field
              label="New password"
              htmlFor="new-password"
              error={passwordForm.formState.errors.newPassword?.message}
            >
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                {...passwordForm.register('newPassword')}
              />
            </Field>
            <Field
              label="Confirm new password"
              htmlFor="confirm-password"
              error={passwordForm.formState.errors.confirm?.message}
            >
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                {...passwordForm.register('confirm')}
              />
            </Field>
          </div>
        </SettingsSection>
      </form>
    </div>
  );
}
