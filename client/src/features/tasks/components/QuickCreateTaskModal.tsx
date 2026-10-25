import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  TASK_TYPES,
  TYPE_META,
  workflowOf,
  type Priority,
  type Severity,
  type TaskType,
} from '@msr/shared/enums';
import { can, canAssign } from '@msr/shared/permissions';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Switch } from '../../../components/ui/Switch';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useLocalState } from '../../../hooks/useLocalState';
import { errorMessage } from '../../../lib/api';
import { useProject, useProjects } from '../../projects/api';
import { useCreateTask } from '../api';
import { uploadFiles } from '../collabApi';
import { TypeIcon } from '../taskMeta';
import { useTaskPeek } from '../useTaskPeek';
import { UNASSIGNED, useTaskOptions } from '../useTaskOptions';

export interface QuickCreateDefaults {
  projectKey?: string;
  statusId?: string;
  type?: string;
}

interface QuickCreateTaskModalProps {
  open: boolean;
  defaults: QuickCreateDefaults;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_PROJECT = { statuses: [], labels: [], memberList: [] };

export function QuickCreateTaskModal({ open, defaults, onOpenChange }: QuickCreateTaskModalProps) {
  const reset = (keepFields: boolean) => {
    setTitle('');
    setDescription('');
    setAttachmentIds([]);
    setEditorVersion((version) => version + 1);
    if (!keepFields) {
      setStatusId(null);
      setAssigneeId(null);
      setDueDate(null);
      setLabelIds([]);
      setSeverity(null);
    }
  };

  const close = () => {
    onOpenChange(false);
    reset(false);
    create.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !projectKey) return;
    create.mutate(
      {
        projectKey,
        title: title.trim(),
        description,
        type,
        priority,
        statusId: effectiveStatus ?? undefined,
        assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
        dueDate,
        labelIds,
        severity: type === 'bug' ? severity : null,
        attachmentIds,
      },
      {
        onSuccess: (task) => {
          toast.success(`${task.identifier} created`, {
            action: { label: 'Open', onClick: () => peek.open(task.identifier) },
          });
          setLastProject(projectKey);
          if (createMore) reset(true);
          else close();
        },
      },
    );
  };

  const upload = async (files: File[]) => {
    const uploaded = await uploadFiles(files);
    setAttachmentIds((current) => [...current, ...uploaded.map((file) => file.id)]);
    return uploaded;
  };

  const user = useCurrentUser();
  const peek = useTaskPeek();
  const create = useCreateTask();
  const projects = useProjects();
  const [lastProject, setLastProject] = useLocalState<string | null>('msr-last-project', null);
  const allowed = (projects.data ?? []).filter(
    (project) => !project.isArchived && can(project.permissions, 'task.create'),
  );
  const [chosenProject, setChosenProject] = useState<string | null>(null);
  const projectKey =
    chosenProject ??
    [defaults.projectKey, lastProject].find((key) => key && allowed.some((project) => project.key === key)) ??
    allowed[0]?.key ??
    null;
  const project = useProject(projectKey ?? '');
  const options = useTaskOptions(project.data ?? EMPTY_PROJECT);
  const [type, setType] = useState<TaskType>((defaults.type as TaskType) ?? 'task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [editorVersion, setEditorVersion] = useState(0);
  const [statusId, setStatusId] = useState<string | null>(defaults.statusId ?? null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const mask = project.data?.permissions ?? 0;
  const canAssignOthers = canAssign(mask, null, '__other__', user.id);
  const assigneeOptions = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...options.assignee.filter((option) => canAssignOthers || option.value === user.id),
  ];
  const workflowStatuses = options.status(workflowOf(type));
  const effectiveStatus = workflowStatuses.some((option) => option.value === statusId) ? statusId : null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="New task"
      size="lg"
      footer={
        <>
          <Switch
            size="sm"
            checked={createMore}
            onCheckedChange={setCreateMore}
            label="Create more"
            className="mr-auto"
          />
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-create"
            loading={create.isPending}
            disabled={!title.trim() || !projectKey}
          >
            Create task
          </Button>
        </>
      }
    >
      <form id="quick-create" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {create.error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(create.error)}
          </Banner>
        )}
        {!allowed.length && !projects.isPending && (
          <Banner tone="warning">You don't have permission to create tasks in any project yet.</Banner>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <OptionPicker
            aria-label="Project"
            value={projectKey}
            onChange={(key) => {
              setChosenProject(key);
              setStatusId(null);
              setLabelIds([]);
              setAssigneeId(null);
            }}
            searchable
            options={allowed.map((item) => ({
              value: item.key,
              label: item.name,
              description: item.key,
              icon: <ProjectAvatar color={item.color} icon={item.icon} size="xs" />,
            }))}
            className="h-9"
          />
          <SegmentedControl
            label="Type"
            size="sm"
            value={type}
            onChange={setType}
            options={TASK_TYPES.map((value) => ({
              value,
              label: TYPE_META[value].label,
              icon: <TypeIcon type={value} />,
            }))}
          />
        </div>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={type === 'bug' ? 'What is broken?' : 'Task title'}
          maxLength={300}
          size="lg"
          aria-label="Title"
        />
        <RichTextEditor
          key={editorVersion}
          aria-label="Description"
          value=""
          onChange={setDescription}
          onUpload={can(mask, 'attachment.upload') ? upload : undefined}
          placeholder={
            type === 'bug'
              ? 'Steps to reproduce, expected vs actual… paste screenshots here'
              : 'Add a description… paste screenshots here'
          }
          minHeight={100}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status">
            <OptionPicker
              aria-label="Status"
              value={effectiveStatus ?? workflowStatuses[0]?.value ?? null}
              onChange={setStatusId}
              options={workflowStatuses}
              className="w-full"
            />
          </Field>
          <Field label="Priority">
            <OptionPicker
              aria-label="Priority"
              value={priority}
              onChange={(value) => value && setPriority(value as Priority)}
              options={options.priority}
              className="w-full"
            />
          </Field>
          <Field label="Assignee">
            <OptionPicker
              aria-label="Assignee"
              searchable
              value={assigneeId ?? UNASSIGNED}
              onChange={setAssigneeId}
              options={assigneeOptions}
              className="w-full"
            />
          </Field>
          <Field label="Due date">
            <DatePicker aria-label="Due date" value={dueDate} onChange={setDueDate} className="w-full" />
          </Field>
          <Field label="Labels">
            <OptionPicker
              aria-label="Labels"
              multiple
              searchable
              value={labelIds}
              onChange={setLabelIds}
              options={options.label}
              placeholder="No labels"
              className="w-full"
            />
          </Field>
          {type === 'bug' && (
            <Field label="Severity">
              <OptionPicker
                aria-label="Severity"
                clearable
                value={severity}
                onChange={(value) => setSeverity(value as Severity | null)}
                options={options.severity}
                placeholder="Not set"
                className="w-full"
              />
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}
