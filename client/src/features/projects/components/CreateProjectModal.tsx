import { Check, CircleAlert, Lock, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PROJECT_KEY_REGEX, suggestProjectKey } from '@msr/shared/identifiers';
import {
  MODULE_META,
  PLAN_META,
  PROJECT_MODULES,
  minimumPlan,
  type ProjectModule,
} from '@msr/shared/modules';
import { createProjectSchema } from '@msr/shared/schemas/project';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useRefreshShop, useShop } from '../../shop/api';
import { moduleAccess, packLeft } from '../../shop/moduleAccess';
import { useCreateProject, useKeyAvailability } from '../api';
import { useAppearanceField } from '../useAppearanceField';
import { ProjectAppearanceEditor } from './ProjectAppearanceEditor';
import { ProjectLinkFields } from './ProjectLinkFields';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialModule?: ProjectModule;
}

const NAME_PLACEHOLDERS: Record<ProjectModule, string> = {
  software: 'Website Redesign',
  personal: 'Run a half marathon',
  household: 'The Smith family',
  skill: 'Learn Spanish',
  startup: 'Meal-planning app',
};

const defaultsFor = (module: ProjectModule) => ({
  module,
  name: '',
  key: '',
  description: '',
  color: '#4f56f0',
  icon: MODULE_META[module].icon,
  emblem: null,
  liveUrl: '',
  repoUrl: '',
});

export function CreateProjectModal({
  open,
  onOpenChange,
  initialModule = 'software',
}: CreateProjectModalProps) {
  const submit = (event: FormEvent) =>
    form.handleSubmit((values) =>
      createProject.mutate(values, {
        onSuccess: (project) => {
          toast.success(`${project.name} created`);
          refreshShop();
          close();
          navigate(`/p/${project.key}`);
        },
      }),
    )(event);

  const changeModule = (next: ProjectModule) => {
    form.setValue('module', next);
    if (icon === MODULE_META[module].icon) form.setValue('icon', MODULE_META[next].icon);
  };

  const badgeFor = (value: ProjectModule) => {
    if (!shop.data) return undefined;
    const access = moduleAccess(shop.data, value);
    if (access === 'pack')
      return <Badge size="xs" tone="info" label={`${packLeft(shop.data, value)} left`} />;
    if (access === 'locked')
      return <Badge size="xs" icon={<Lock />} label={PLAN_META[minimumPlan(value)].label} />;
    return undefined;
  };

  const close = () => {
    onOpenChange(false);
    form.reset(defaultsFor(initialModule));
    setKeyTouched(false);
    createProject.reset();
  };

  const navigate = useNavigate();
  const createProject = useCreateProject();
  const shop = useShop();
  const refreshShop = useRefreshShop();
  const form = useZodForm(createProjectSchema, defaultsFor(initialModule));
  const [keyTouched, setKeyTouched] = useState(false);
  const appearance = useAppearanceField(form);
  const [watchedModule, name, key, icon] = form.watch(['module', 'name', 'key', 'icon']);
  const module = watchedModule ?? 'software';
  const normalizedKey = key.trim().toUpperCase();
  const debouncedKey = useDebouncedValue(normalizedKey, 300);
  const availability = useKeyAvailability(debouncedKey, open && PROJECT_KEY_REGEX.test(debouncedKey));
  const locked = shop.data ? moduleAccess(shop.data, module) === 'locked' : false;
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
      description="Pick a module: it sets up the project, its task types and the AI plan for that kind of work."
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
            disabled={availability.data?.available === false || locked}
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
          <div className="flex flex-col gap-2">
            <ChoiceGroup
              label="Module"
              columns={2}
              value={module}
              onChange={changeModule}
              choices={PROJECT_MODULES.map((value) => ({
                value,
                label: MODULE_META[value].label,
                description: MODULE_META[value].description,
                icon: <ProjectIcon name={MODULE_META[value].icon} />,
                badge: badgeFor(value),
                disabled: value !== module && shop.data && moduleAccess(shop.data, value) === 'locked',
              }))}
            />
            {shop.data && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {shop.data.plan.projectsUsed} of {PLAN_META[shop.data.plan.tier].projectsPerYear} new projects
                this year on {PLAN_META[shop.data.plan.tier].label}
                <Link to="/shop" onClick={close} className="font-medium text-accent-text hover:underline">
                  Upgrade or buy projects
                </Link>
              </p>
            )}
          </div>
          <Field label="Name" htmlFor="project-name" required error={errors.name?.message}>
            <Input
              id="project-name"
              autoFocus
              placeholder={NAME_PLACEHOLDERS[module]}
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
          {MODULE_META[module].taskTypes.includes('bug') && (
            <ProjectLinkFields
              liveUrl={form.register('liveUrl')}
              repoUrl={form.register('repoUrl')}
              errors={{ liveUrl: errors.liveUrl?.message, repoUrl: errors.repoUrl?.message }}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-3">
            <ProjectAvatar appearance={appearance.value} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name || 'Project name'}</p>
              <p className="font-mono text-xs text-muted">{normalizedKey || 'KEY'}</p>
            </div>
          </div>
          <ProjectAppearanceEditor preview={false} value={appearance.value} onChange={appearance.onChange} />
        </div>
      </form>
    </Modal>
  );
}
