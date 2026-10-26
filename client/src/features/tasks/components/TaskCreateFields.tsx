import type { ReactNode } from 'react';
import { workflowOf, type Priority, type Severity, type TaskType } from '@msr/shared/enums';
import { canAssign } from '@msr/shared/permissions';
import type { ProjectDetail, TaskRecurrence } from '@msr/shared/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Field } from '../../../components/ui/Field';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { cn } from '../../../lib/cn';
import { UNASSIGNED, useTaskOptions } from '../useTaskOptions';
import { RecurrencePicker } from './RecurrencePicker';

export type TaskCreateField =
  'type' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'recurrence' | 'labels' | 'severity';

export interface TaskCreateValues {
  type: TaskType;
  statusId: string | null;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  recurrence: TaskRecurrence | null;
  labelIds: string[];
  severity: Severity | null;
}

interface TaskCreateFieldsProps {
  project: Pick<ProjectDetail, 'statuses' | 'labels' | 'memberList' | 'permissions'>;
  values: TaskCreateValues;
  onChange: (patch: Partial<TaskCreateValues>) => void;
  fields?: TaskCreateField[];
  types?: readonly TaskType[];
  layout?: 'grid' | 'compact';
  className?: string;
}

const ALL_FIELDS: TaskCreateField[] = [
  'type',
  'status',
  'priority',
  'assignee',
  'dueDate',
  'recurrence',
  'labels',
  'severity',
];
const LABELS: Record<TaskCreateField, string> = {
  type: 'Type',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  dueDate: 'Due date',
  recurrence: 'Repeat',
  labels: 'Labels',
  severity: 'Severity',
};
const COMPACT_CONTROL = 'h-7 max-w-40 gap-1.5 rounded-full px-2.5 text-xs [&_svg]:size-3.5';

export function TaskCreateFields({
  project,
  values,
  onChange,
  fields = ALL_FIELDS,
  types,
  layout = 'grid',
  className,
}: TaskCreateFieldsProps) {
  const control = (field: TaskCreateField, node: ReactNode) =>
    layout === 'grid' ? (
      <Field key={field} label={LABELS[field]}>
        {node}
      </Field>
    ) : (
      <span key={field} className="contents">
        {node}
      </span>
    );

  const user = useCurrentUser();
  const options = useTaskOptions(project);
  const controlClass = layout === 'grid' ? 'w-full' : COMPACT_CONTROL;
  const typeOptions = options.type.filter((option) => !types || types.includes(option.value));
  const statusOptions = options.status(workflowOf(values.type));
  const statusId = statusOptions.some((option) => option.value === values.statusId)
    ? values.statusId
    : (statusOptions[0]?.value ?? null);
  const canAssignOthers = canAssign(project.permissions, null, '__other__', user.id);
  const assigneeOptions = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...options.assignee.filter((option) => canAssignOthers || option.value === user.id),
  ];
  const visible = fields.filter(
    (field) =>
      (field !== 'severity' || values.type === 'bug') && (field !== 'type' || typeOptions.length > 1),
  );

  const renderers: Record<TaskCreateField, () => ReactNode> = {
    type: () => (
      <OptionPicker
        aria-label={LABELS.type}
        value={values.type}
        onChange={(type) => type && onChange({ type: type as TaskType })}
        options={typeOptions}
        className={controlClass}
      />
    ),
    status: () => (
      <OptionPicker
        aria-label={LABELS.status}
        value={statusId}
        onChange={(statusId) => onChange({ statusId })}
        options={statusOptions}
        className={controlClass}
      />
    ),
    priority: () => (
      <OptionPicker
        aria-label={LABELS.priority}
        value={values.priority}
        onChange={(priority) => priority && onChange({ priority: priority as Priority })}
        options={options.priority}
        className={controlClass}
      />
    ),
    assignee: () => (
      <OptionPicker
        aria-label={LABELS.assignee}
        searchable
        value={values.assigneeId ?? UNASSIGNED}
        onChange={(assigneeId) => onChange({ assigneeId: assigneeId === UNASSIGNED ? null : assigneeId })}
        options={assigneeOptions}
        className={controlClass}
      />
    ),
    dueDate: () => (
      <DatePicker
        aria-label={LABELS.dueDate}
        placeholder={layout === 'grid' ? 'Set date' : 'Due date'}
        value={values.dueDate}
        onChange={(dueDate) => onChange({ dueDate })}
        className={controlClass}
      />
    ),
    recurrence: () => (
      <RecurrencePicker
        aria-label={LABELS.recurrence}
        value={values.recurrence}
        onChange={(recurrence) => onChange({ recurrence })}
        members={project.memberList}
        placeholder={layout === 'grid' ? "Doesn't repeat" : 'Repeat'}
        className={controlClass}
      />
    ),
    labels: () => (
      <OptionPicker
        aria-label={LABELS.labels}
        multiple
        searchable
        value={values.labelIds}
        onChange={(labelIds) => onChange({ labelIds })}
        options={options.label}
        placeholder={layout === 'grid' ? 'No labels' : 'Labels'}
        className={controlClass}
      />
    ),
    severity: () => (
      <OptionPicker
        aria-label={LABELS.severity}
        clearable
        value={values.severity}
        onChange={(severity) => onChange({ severity: severity as Severity | null })}
        options={options.severity}
        placeholder={layout === 'grid' ? 'Not set' : 'Severity'}
        className={controlClass}
      />
    ),
  };

  return (
    <div
      className={cn(
        layout === 'grid' ? 'grid gap-3 sm:grid-cols-3' : 'flex flex-wrap items-center gap-1.5',
        className,
      )}
    >
      {visible.map((field) => control(field, renderers[field]()))}
    </div>
  );
}
