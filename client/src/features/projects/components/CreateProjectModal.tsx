import { Check, CircleAlert, FolderKanban, House, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PROJECT_KIND_META, PROJECT_KINDS, type ProjectKind } from '@msr/shared/enums';
import { PROJECT_KEY_REGEX, suggestProjectKey } from '@msr/shared/identifiers';
import { createProjectSchema } from '@msr/shared/schemas/project';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Field } from '../../../components/ui/Field';
import { IconPicker } from '../../../components/ui/IconPicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useCreateProject, useKeyAvailability } from '../api';
import { ProjectLinkFields } from './ProjectLinkFields';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_ICONS = { software: <FolderKanban />, household: <House /> };

const DEFAULTS = {
  kind: 'software' as ProjectKind,
  name: '',
  key: '',
  description: '',
  color: '#4f56f0',
  icon: 'hexagon',
  liveUrl: '',
  repoUrl: '',
};

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const submit = (event: FormEvent) =>
    form.handleSubmit((values) =>
      createProject.mutate(values, {
        onSuccess: (project) => {
          toast.success(`${project.name} created`);
          close();
          navigate(`/p/${project.key}`);
        },
      }),
    )(event);

  const changeKind = (next: ProjectKind) => {
    form.setValue('kind', next);
    if (icon === PROJECT_KIND_META[kind].icon) form.setValue('icon', PROJECT_KIND_META[next].icon);
  };

  const close = () => {
    onOpenChange(false);
    form.reset(DEFAULTS);
    setKeyTouched(false);
    createProject.reset();
  };

  const navigate = useNavigate();
  const createProject = useCreateProject();
  const form = useZodForm(createProjectSchema, DEFAULTS);
  const [keyTouched, setKeyTouched] = useState(false);
  const [watchedKind, name, key, color, icon] = form.watch(['kind', 'name', 'key', 'color', 'icon']);
  const kind = watchedKind ?? 'software';
  const normalizedKey = key.trim().toUpperCase();
  const debouncedKey = useDebouncedValue(normalizedKey, 300);
  const availability = useKeyAvailability(debouncedKey, open && PROJECT_KEY_REGEX.test(debouncedKey));
  const { errors } = form.formState;

  useEffect(() => {
    if (!keyTouched)
      form.setValue('key', name.trim() ? suggestProjectKey(name) : '', { shouldValidate: !!name.trim() });
  }, [name, keyTouched, form]);

  useEffect(() => {
    const result = availability.data;
    if (keyTouched || !result || result.key !== normalizedKey || result.available || !result.suggestion)
      return;
    form.setValue('key', result.suggestion, { shouldValidate: true });
  }, [availability.data, keyTouched, normalizedKey, form]);

  const keyStatus =
    !PROJECT_KEY_REGEX.test(normalizedKey) || debouncedKey !== normalizedKey || availability.isFetching ? (
      normalizedKey && <Spinner className="text-subtle" />
    ) : availability.data?.available ? (
      <Check className="size-4 text-success" />
    ) : (
      <X className="size-4 text-danger" />
    );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="New project"
      description="A software project for team work, or a household for chores, shopping and the family calendar."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-project"
            loading={createProject.isPending}
            disabled={availability.data?.available === false}
          >
            Create project
          </Button>
        </>
      }
    >
      <form id="create-project" onSubmit={submit} className="grid gap-5 md:grid-cols-[1fr_240px]" noValidate>
        <div className="flex flex-col gap-4">
          {createProject.error && (
            <Banner tone="danger" icon={<CircleAlert />}>
              {errorMessage(createProject.error)}
            </Banner>
          )}
          <ChoiceGroup
            label="Project type"
            columns={2}
            value={kind}
            onChange={changeKind}
            choices={PROJECT_KINDS.map((value) => ({
              value,
              label: PROJECT_KIND_META[value].label,
              description: PROJECT_KIND_META[value].description,
              icon: KIND_ICONS[value],
            }))}
          />
          <Field label="Name" htmlFor="project-name" required error={errors.name?.message}>
            <Input
              id="project-name"
              autoFocus
              placeholder={kind === 'household' ? 'The Smith family' : 'Website Redesign'}
              {...form.register('name')}
            />
          </Field>
          <Field
            label="Key"
            htmlFor="project-key"
            required
            hint={`Task IDs look like ${normalizedKey || 'KEY'}-101. The key can't be changed later.`}
            error={
              errors.key?.message ??
              (availability.data?.available === false && availability.data.key === normalizedKey
                ? `${normalizedKey} is taken`
                : undefined)
            }
          >
            <Input
              id="project-key"
              maxLength={6}
              className="font-mono uppercase"
              rightSlot={<span className="pr-2">{keyStatus}</span>}
              {...form.register('key', { onChange: () => setKeyTouched(true) })}
            />
          </Field>
          <Field label="Description" htmlFor="project-description" error={errors.description?.message}>
            <Textarea
              id="project-description"
              rows={3}
              placeholder="What is this project about?"
              {...form.register('description')}
            />
          </Field>
          {kind === 'software' && (
            <ProjectLinkFields
              liveUrl={form.register('liveUrl')}
              repoUrl={form.register('repoUrl')}
              errors={{ liveUrl: errors.liveUrl?.message, repoUrl: errors.repoUrl?.message }}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-3">
            <ProjectAvatar color={color} icon={icon} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name || 'Project name'}</p>
              <p className="font-mono text-xs text-muted">{normalizedKey || 'KEY'}</p>
            </div>
          </div>
          <Field label="Color">
            <ColorPicker value={color} onChange={(value) => form.setValue('color', value)} />
          </Field>
          <Field label="Icon">
            <IconPicker
              value={icon}
              color={color}
              onChange={(value) => form.setValue('icon', value)}
              className="grid-cols-6"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
