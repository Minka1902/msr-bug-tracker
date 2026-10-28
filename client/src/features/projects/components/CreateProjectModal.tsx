import { Check, CircleAlert, Lock, Sparkles, X } from 'lucide-react';
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
import type { PlanQuestion, PlanTask } from '@msr/shared/schemas/planner';
import { createProjectSchema } from '@msr/shared/schemas/project';
import type { ProjectDetail } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useZodForm } from '../../../hooks/useZodForm';
import { errorMessage } from '../../../lib/api';
import { useWorkers } from '../../agents/api';
import { useCommitPlan, useDraftPlan, useAskQuestions } from '../../planner/api';
import { IdeaQuestions } from '../../planner/components/IdeaQuestions';
import { PlanPreview } from '../../planner/components/PlanPreview';
import { useAiKeys } from '../../settings/aiKeysApi';
import { useRefreshShop, useShop } from '../../shop/api';
import { moduleAccess, packLeft } from '../../shop/moduleAccess';
import { useCreateProject, useKeyAvailability } from '../api';
import { useAppearanceField } from '../useAppearanceField';
import { ProjectAppearanceEditor } from './ProjectAppearanceEditor';
import { ProjectLinkFields } from './ProjectLinkFields';

type Step = 'details' | 'questions' | 'plan';

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

const DESCRIPTIONS: Record<Step, string> = {
  details: 'Pick a module: it sets up the project, its task types and the AI plan for that kind of work.',
  questions: 'Answer what you can. It helps the AI size the plan to you.',
  plan: 'Untick anything you don’t want. Your AI worker gets the AI tasks.',
};

const NO_WORKER = '__none__';

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
    form.handleSubmit((values) => {
      if (step === 'details' && newIdea)
        return askQuestions.mutate(
          { module: values.module, name: values.name, description: values.description },
          {
            onSuccess: (asked) => {
              setQuestions(asked);
              setAnswers(asked.map(() => ''));
              setStep('questions');
            },
          },
        );
      if (created) return draft(created);
      createProject.mutate(values, {
        onSuccess: (project) => {
          refreshShop();
          if (step === 'questions') {
            setCreated(project);
            draft(project);
          } else finish(project);
        },
      });
    })(event);

  const draft = (project: ProjectDetail) =>
    draftPlan.mutate(
      {
        module: project.module,
        name: project.name,
        description: project.description,
        answers: questions.map((item, index) => ({ question: item.question, answer: answers[index] ?? '' })),
      },
      {
        onSuccess: (tasks) => {
          setPlan(tasks);
          setSelected(tasks.map(() => true));
          setStep('plan');
        },
      },
    );

  const addTasks = () =>
    created &&
    commitPlan.mutate(
      {
        projectKey: created.key,
        tasks: plan.filter((_, index) => selected[index]),
        agentId: plannedWorker === NO_WORKER ? null : plannedWorker,
      },
      {
        onSuccess: ({ created: count }) => {
          toast.success(`${count} tasks added to ${created.name}`);
          finish(created);
        },
      },
    );

  const finish = (project: ProjectDetail) => {
    toast.success(`${project.name} created`);
    close();
    navigate(`/p/${project.key}`);
  };

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
    setStep('details');
    setNewIdea(false);
    setCreated(null);
    createProject.reset();
    askQuestions.reset();
    draftPlan.reset();
    commitPlan.reset();
  };

  const navigate = useNavigate();
  const createProject = useCreateProject();
  const askQuestions = useAskQuestions();
  const draftPlan = useDraftPlan();
  const commitPlan = useCommitPlan();
  const aiKeys = useAiKeys();
  const workers = useWorkers();
  const shop = useShop();
  const refreshShop = useRefreshShop();
  const form = useZodForm(createProjectSchema, defaultsFor(initialModule));
  const [keyTouched, setKeyTouched] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [newIdea, setNewIdea] = useState(false);
  const [questions, setQuestions] = useState<PlanQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [created, setCreated] = useState<ProjectDetail | null>(null);
  const [plan, setPlan] = useState<PlanTask[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const appearance = useAppearanceField(form);
  const [watchedModule, name, key, icon] = form.watch(['module', 'name', 'key', 'icon']);
  const module = watchedModule ?? 'software';
  const normalizedKey = key.trim().toUpperCase();
  const debouncedKey = useDebouncedValue(normalizedKey, 300);
  const availability = useKeyAvailability(debouncedKey, open && PROJECT_KEY_REGEX.test(debouncedKey));
  const locked = shop.data ? moduleAccess(shop.data, module) === 'locked' : false;
  const hasAiKey = !!aiKeys.data?.length;
  const connectedWorkers = (workers.data ?? []).filter((worker) => worker.connection);
  const plannedWorker = workerId ?? connectedWorkers[0]?.id ?? NO_WORKER;
  const keptCount = selected.filter(Boolean).length;
  const needsWorker = plan.some((task, index) => selected[index] && task.doer !== 'human');
  const error = createProject.error ?? askQuestions.error ?? draftPlan.error ?? commitPlan.error;
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
      description={DESCRIPTIONS[step]}
      size="lg"
      footer={
        step === 'details' ? (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-project"
              leftIcon={newIdea ? <Sparkles /> : undefined}
              loading={createProject.isPending || askQuestions.isPending}
              disabled={availability.data?.available === false || locked}
            >
              {newIdea ? 'Generate' : 'Create project'}
            </Button>
          </>
        ) : step === 'questions' ? (
          <>
            {created ? (
              <Button variant="secondary" onClick={() => finish(created)}>
                Open project
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setStep('details')}>
                Back
              </Button>
            )}
            <Button
              type="submit"
              form="create-project"
              leftIcon={<Sparkles />}
              loading={createProject.isPending || draftPlan.isPending}
            >
              {created ? 'Try again' : 'Create project & plan'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => created && finish(created)}>
              Skip the plan
            </Button>
            <Button onClick={addTasks} loading={commitPlan.isPending} disabled={!keptCount}>
              Add {keptCount} tasks
            </Button>
          </>
        )
      }
    >
      {error && (
        <Banner tone="danger" icon={<CircleAlert />} className="mb-4">
          {errorMessage(error)}
          {!hasAiKey && askQuestions.error && (
            <>
              {' '}
              <Link to="/settings/ai" onClick={close} className="font-medium underline">
                Open Settings → AI
              </Link>
            </>
          )}
        </Banner>
      )}
      {step === 'questions' && (
        <form id="create-project" onSubmit={submit} noValidate>
          <IdeaQuestions
            questions={questions}
            answers={answers}
            onChange={(index, answer) =>
              setAnswers((current) => current.map((value, at) => (at === index ? answer : value)))
            }
          />
        </form>
      )}
      {step === 'plan' && (
        <div className="flex flex-col gap-4">
          {needsWorker && (
            <Field label="AI tasks go to">
              <OptionPicker
                aria-label="AI tasks go to"
                value={plannedWorker}
                onChange={(next) => setWorkerId(next ?? NO_WORKER)}
                options={[
                  ...connectedWorkers.map((worker) => ({ value: worker.id, label: worker.name })),
                  { value: NO_WORKER, label: 'Nobody yet, leave them unassigned' },
                ]}
                className="w-full sm:w-80"
              />
            </Field>
          )}
          <PlanPreview
            tasks={plan}
            selected={selected}
            onToggle={(index) =>
              setSelected((current) => current.map((value, at) => (at === index ? !value : value)))
            }
          />
        </div>
      )}
      <form
        id={step === 'details' ? 'create-project' : undefined}
        onSubmit={submit}
        hidden={step !== 'details'}
        className="grid gap-5 md:grid-cols-[1fr_240px]"
        noValidate
      >
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col gap-1.5">
            <Checkbox
              checked={newIdea}
              onCheckedChange={setNewIdea}
              disabled={!hasAiKey}
              label="This is a new idea, plan it with AI"
            />
            <p className="pl-7 text-xs text-muted">
              {hasAiKey ? (
                'Your AI asks a few questions, then breaks the idea into small steps with deadlines.'
              ) : (
                <>
                  Add a Claude, ChatGPT, Gemini or Grok key in{' '}
                  <Link
                    to="/settings/ai"
                    onClick={close}
                    className="font-medium text-accent-text hover:underline"
                  >
                    Settings → AI
                  </Link>{' '}
                  to use this.
                </>
              )}
            </p>
          </div>
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
