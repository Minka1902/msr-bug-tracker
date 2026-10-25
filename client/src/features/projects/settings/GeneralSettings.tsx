import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { colorSchema, iconSchema } from '@msr/shared/schemas/project';
import { Button } from '../../../components/ui/Button';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Field } from '../../../components/ui/Field';
import { IconPicker } from '../../../components/ui/IconPicker';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/dates';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useUpdateProject } from '../api';
import { useProjectContext } from '../useProjectContext';
import { useProjectPermissions } from '../useProjectPermissions';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(2000),
  color: colorSchema,
  icon: iconSchema,
});

export function GeneralSettings() {
  const submit = (event: FormEvent) =>
    form.handleSubmit((values) =>
      update.mutate(values, {
        onSuccess: () => {
          form.reset(values);
          toast.success('Project updated');
        },
        onError: (error) => toast.error(errorMessage(error)),
      }),
    )(event);

  const project = useProjectContext();
  const { can, deniedReason } = useProjectPermissions(project);
  const update = useUpdateProject(project.key);
  const form = useZodForm(schema, {
    name: project.name,
    description: project.description,
    color: project.color,
    icon: project.icon,
  });
  const [color, icon] = form.watch(['color', 'icon']);
  const editable = can('project.edit');

  return (
    <form onSubmit={submit} noValidate>
      <SettingsSection
        title="Project details"
        description={
          <span className="flex flex-col gap-1">
            {editable ? 'Name, description and how the project looks.' : deniedReason}
            <span className="text-xs">Created {formatDateTime(project.createdAt)}</span>
            <span className="text-xs">Updated {formatDateTime(project.lastActivityAt)}</span>
          </span>
        }
        footer={
          editable && (
            <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
              Save changes
            </Button>
          )
        }
      >
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
            <Input id="name" {...form.register('name')} />
          </Field>
          <Field label="Key" htmlFor="key" hint="Keys are permanent so task links never break.">
            <Input id="key" value={project.key} disabled className="font-mono" />
          </Field>
          <Field label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
            <Textarea id="description" rows={4} {...form.register('description')} />
          </Field>
          <Field label="Color">
            <ColorPicker
              value={color}
              onChange={(value) => form.setValue('color', value, { shouldDirty: true })}
            />
          </Field>
          <Field label="Icon">
            <IconPicker
              value={icon}
              color={color}
              onChange={(value) => form.setValue('icon', value, { shouldDirty: true })}
              className="sm:grid-cols-10"
            />
          </Field>
        </fieldset>
      </SettingsSection>
    </form>
  );
}
