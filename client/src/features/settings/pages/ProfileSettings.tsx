import { Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { nameSchema } from '@msr/shared/schemas/auth';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useRemoveAvatar, useUpdateMe } from '../../auth/api';
import { SettingsSection } from '../components/SettingsSection';

const schema = z.object({ name: nameSchema });
const notify = {
  onSuccess: () => toast.success('Profile updated'),
  onError: (error: unknown) => toast.error(errorMessage(error)),
};

export function ProfileSettings() {
  const submit = (event: FormEvent) => form.handleSubmit((values) => updateMe.mutate(values, notify))(event);

  const user = useCurrentUser();
  const updateMe = useUpdateMe();
  const removeAvatar = useRemoveAvatar();
  const form = useZodForm(schema, { name: user.name });

  return (
    <div className="flex flex-col gap-4">
      {user.avatarUrl && (
        <SettingsSection title="Photo" description="Photo uploads are turned off for now.">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" />
            <Button
              variant="danger-ghost"
              leftIcon={<Trash2 />}
              loading={removeAvatar.isPending}
              onClick={() => removeAvatar.mutate(undefined, notify)}
            >
              Remove
            </Button>
          </div>
        </SettingsSection>
      )}
      <form onSubmit={submit} noValidate>
        <SettingsSection
          title="Profile"
          description="This is how teammates see you."
          footer={
            <Button type="submit" loading={updateMe.isPending} disabled={!form.formState.isDirty}>
              Save
            </Button>
          }
        >
          <Field label="Full name" htmlFor="name" error={form.formState.errors.name?.message}>
            <Input id="name" autoComplete="name" {...form.register('name')} />
          </Field>
        </SettingsSection>
      </form>
    </div>
  );
}
