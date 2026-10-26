import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { STATUS_CATEGORIES, STATUS_CATEGORY_META, type StatusCategory } from '@msr/shared/enums';
import { PROJECT_KEY_REGEX, suggestProjectKey } from '@msr/shared/identifiers';
import { can } from '@msr/shared/permissions';
import type { ProjectStatus } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useProject, useProjects } from '../../projects/api';
import type { CommitInput, MigrationJob } from '../api';

interface MappingStepProps {
  job: MigrationJob;
  formId: string;
  error: unknown;
  onSubmit: (input: CommitInput) => void;
}

type Target = 'new' | 'existing';

const UNASSIGNED = '__none__';
const NEW_PROJECT_STYLE = { kind: 'software' as const, color: '#4f56f0', icon: 'hexagon', description: '' };

const statusFor = (statuses: ProjectStatus[], name: string, category: StatusCategory) => {
  const taskStatuses = statuses.filter((status) => status.workflow === 'task');
  const byName = taskStatuses.find((status) => status.name.toLowerCase() === name.toLowerCase());
  if (byName) return byName.id;
  const order = [category, ...STATUS_CATEGORIES.filter((item) => item !== category)];
  for (const candidate of order) {
    const match = taskStatuses.find((status) => status.category === candidate);
    if (match) return match.id;
  }
  return null;
};

export function MappingStep({ job, formId, error, onSubmit }: MappingStepProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const memberMap = Object.fromEntries(job.people.map((person) => [person.key, memberOf(person)]));
    if (target === 'new') {
      onSubmit({
        target: { project: { name: name.trim(), key, ...NEW_PROJECT_STYLE } },
        statusMap: {},
        memberMap,
      });
      return;
    }
    const statusMap = Object.fromEntries(
      job.statuses.flatMap((status) => {
        const id = statusOf(status);
        return id ? [[status.name, id]] : [];
      }),
    );
    onSubmit({ target: { projectKey: existingKey! }, statusMap, memberMap });
  };

  const statusOf = (status: MigrationJob['statuses'][number]) =>
    statusOverrides[status.name] ?? statusFor(existing.data?.statuses ?? [], status.name, status.category);

  const memberOf = (person: MigrationJob['people'][number]) => {
    if (person.key in memberOverrides) return memberOverrides[person.key]!;
    const match = members.find(
      (member) =>
        (person.email && member.email.toLowerCase() === person.email.toLowerCase()) ||
        (person.name && member.name.toLowerCase() === person.name.toLowerCase()),
    );
    return match?.id ?? null;
  };

  const user = useCurrentUser();
  const projects = useProjects();
  const [target, setTarget] = useState<Target>('new');
  const [name, setName] = useState(job.sourceName ?? 'Imported project');
  const [keyInput, setKeyInput] = useState<string | null>(null);
  const [existingKey, setExistingKey] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [memberOverrides, setMemberOverrides] = useState<Record<string, string | null>>({});
  const existing = useProject(target === 'existing' ? (existingKey ?? '') : '');
  const key = (keyInput ?? suggestProjectKey(name)).trim().toUpperCase();
  const allowed = (projects.data ?? []).filter(
    (project) => !project.isArchived && can(project.permissions, 'task.create'),
  );
  const members =
    target === 'existing'
      ? (existing.data?.memberList ?? [])
      : [{ id: user.id, name: user.name, email: user.email }];
  const statusOptions = (existing.data?.statuses ?? []).map((status) => ({
    value: status.id,
    label: status.name,
    color: status.color,
    group: status.workflow === 'bug' ? 'Bugs' : 'Tasks',
  }));
  const memberOptions = [
    { value: UNASSIGNED, label: 'Leave unassigned' },
    ...members.map((member) => ({ value: member.id, label: member.name, description: member.email })),
  ];

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {!!error && (
        <Banner tone="danger" icon={<CircleAlert />}>
          {errorMessage(error)}
        </Banner>
      )}
      <p className="text-sm">
        Found <strong>{job.total}</strong> items in <strong>{job.sourceName}</strong>. Choose where they go.
      </p>
      <SegmentedControl
        label="Import into"
        value={target}
        onChange={setTarget}
        block
        options={[
          { value: 'new', label: 'A new project' },
          { value: 'existing', label: 'An existing project' },
        ]}
      />
      {target === 'new' ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Field label="Project name" htmlFor="migration-project-name">
            <Input
              id="migration-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Key"
            htmlFor="migration-project-key"
            error={key && !PROJECT_KEY_REGEX.test(key) ? '2–6 letters or digits' : undefined}
          >
            <Input
              id="migration-project-key"
              value={key}
              maxLength={6}
              className="font-mono uppercase"
              onChange={(event) => setKeyInput(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field label="Project">
          <OptionPicker
            aria-label="Project"
            searchable
            placeholder="Choose a project"
            value={existingKey}
            onChange={(next) => {
              setExistingKey(next);
              setStatusOverrides({});
              setMemberOverrides({});
            }}
            options={allowed.map((project) => ({
              value: project.key,
              label: project.name,
              description: project.key,
            }))}
            className="w-full"
          />
        </Field>
      )}
      {job.statuses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Statuses</h3>
          <div className="flex flex-col divide-y divide-border rounded-control border border-border">
            {job.statuses.map((status) => (
              <div key={status.name} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{status.name}</span>
                <Badge size="xs" label={`${status.count}`} />
                {target === 'existing' && existing.data ? (
                  <OptionPicker
                    aria-label={`Status for ${status.name}`}
                    value={statusOf(status)}
                    onChange={(next) =>
                      next && setStatusOverrides((current) => ({ ...current, [status.name]: next }))
                    }
                    options={statusOptions}
                    className="h-8 w-44 text-xs"
                  />
                ) : (
                  <span className="text-xs text-muted">
                    → {STATUS_CATEGORY_META[status.category].label} column
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {job.people.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">People</h3>
          <p className="text-xs text-muted">
            Only project members can be assignees. Unassigned tasks keep a note of who had them, and you can
            invite people from the project's Members settings afterwards.
          </p>
          <div className="flex flex-col divide-y divide-border rounded-control border border-border">
            {job.people.map((person) => (
              <div key={person.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{person.name ?? person.email}</span>
                  {person.email && person.name && (
                    <span className="block truncate text-xs text-muted">{person.email}</span>
                  )}
                </span>
                <Badge size="xs" label={`${person.count}`} />
                <OptionPicker
                  aria-label={`Assignee for ${person.name ?? person.email}`}
                  value={memberOf(person) ?? UNASSIGNED}
                  onChange={(next) =>
                    setMemberOverrides((current) => ({
                      ...current,
                      [person.key]: next === UNASSIGNED ? null : next,
                    }))
                  }
                  options={memberOptions}
                  className="h-8 w-44 text-xs"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}
