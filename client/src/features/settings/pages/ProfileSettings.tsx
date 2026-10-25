import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, type ChangeEvent, type FormEvent } from 'react';
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
import { useUpdateMe, useUploadAvatar } from '../../auth/api';
import { SettingsSection } from '../components/SettingsSection';

const schema = z.object({ name: nameSchema });
const notify = {
  onSuccess: () => toast.success('Profile updated'),
  onError: (error: unknown) => toast.error(errorMessage(error)),
};

export function ProfileSettings() {
  const submit = (event: FormEvent) => form.handleSubmit((values) => updateMe.mutate(values, notify))(event);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadAvatar.mutate(file, notify);
  };

  const user = useCurrentUser();
  const updateMe = useUpdateMe();
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useZodForm(schema, { name: user.name });

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection title="Photo" description="PNG, JPG, GIF or WebP up to 2 MB.">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={handleFile}
            />
            <Button
              variant="secondary"
              leftIcon={<ImageUp />}
              loading={uploadAvatar.isPending}
              onClick={() => fileRef.current?.click()}
            >
              Upload photo
            </Button>
            {user.avatarUrl && (
              <Button
                variant="danger-ghost"
                leftIcon={<Trash2 />}
                onClick={() => uploadAvatar.mutate(null, notify)}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>
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
