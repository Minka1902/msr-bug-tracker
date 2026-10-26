import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { projectDetailsSchema } from '@msr/shared/schemas/project';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/dates';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useUpdateProject } from '../api';
import { ProjectAppearanceEditor } from '../components/ProjectAppearanceEditor';
import { ProjectLinkFields } from '../components/ProjectLinkFields';
import { useAppearanceField } from '../useAppearanceField';
import { useProjectContext } from '../useProjectContext';
import { useProjectPermissions } from '../useProjectPermissions';

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
  const form = useZodForm(projectDetailsSchema, {
    name: project.name,
    description: project.description,
    color: project.color,
    icon: project.icon,
    emblem: project.emblem,
    liveUrl: project.liveUrl ?? '',
    repoUrl: project.repoUrl ?? '',
  });
  const appearance = useAppearanceField(form);
  const { errors } = form.formState;
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
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...form.register('name')} />
          </Field>
          <Field label="Key" htmlFor="key" hint="Keys are permanent so task links never break.">
            <Input id="key" value={project.key} disabled className="font-mono" />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={4} {...form.register('description')} />
          </Field>
          <ProjectLinkFields
            liveUrl={form.register('liveUrl')}
            repoUrl={form.register('repoUrl')}
            errors={{ liveUrl: errors.liveUrl?.message, repoUrl: errors.repoUrl?.message }}
          />
          <Field label="Look">
            <ProjectAppearanceEditor value={appearance.value} onChange={appearance.onChange} />
          </Field>
        </fieldset>
      </SettingsSection>
    </form>
  );
}
