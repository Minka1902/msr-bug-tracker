import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { TYPE_META, workflowOf } from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import { can } from '@msr/shared/permissions';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
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
import { useConflictGuard } from '../../calendar/useConflictGuard';
import { useProject, useProjects } from '../../projects/api';
import { useCreateTask } from '../api';
import { uploadFiles } from '../collabApi';
import { TypeIcon, typeLabel } from '../taskMeta';
import { useTaskPeek } from '../useTaskPeek';
import type { QuickCreateDefaults } from '../../../context/shellContext';
import { TaskCreateFields, taskCreateValues, type TaskCreateValues } from './TaskCreateFields';

interface QuickCreateTaskModalProps {
  open: boolean;
  defaults: QuickCreateDefaults;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_PROJECT = {
  statuses: [],
  labels: [],
  memberList: [],
  permissions: 0,
  cardTypes: [],
  isOwner: false,
};
export function QuickCreateTaskModal({ open, defaults, onOpenChange }: QuickCreateTaskModalProps) {
  const { projectKey: defaultProject, ...presets } = defaults;

  const reset = (keepFields: boolean) => {
    setTitle('');
    setDescription('');
    setAttachmentIds([]);
    setEditorVersion((version) => version + 1);
    if (!keepFields)
      setFields((current) => taskCreateValues(current.type, { cardTypeId: current.cardTypeId }));
  };

  const close = () => {
    onOpenChange(false);
    reset(false);
    create.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !projectKey) return;
    if (fields.dueDate && !(await guard({ userIds: [fields.assigneeId ?? user.id], date: fields.dueDate })))
      return;
    create.mutate(
      {
        projectKey,
        title: title.trim(),
        description,
        type,
        cardTypeId: cardType?.id,
        priority: fields.priority,
        statusId: effectiveStatus ?? undefined,
        assigneeId: fields.assigneeId,
        dueDate: fields.dueDate,
        recurrence: fields.recurrence,
        labelIds: fields.labelIds,
        severity: type === 'bug' ? fields.severity : null,
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

  const patchFields = (patch: Partial<TaskCreateValues>) =>
    setFields((current) => ({ ...current, ...patch }));

  const user = useCurrentUser();
  const guard = useConflictGuard();
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
    [defaultProject, lastProject].find((key) => key && allowed.some((project) => project.key === key)) ??
    allowed[0]?.key ??
    null;
  const project = useProject(projectKey ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [editorVersion, setEditorVersion] = useState(0);
  const [fields, setFields] = useState<TaskCreateValues>(() => taskCreateValues('task', presets));
  const [createMore, setCreateMore] = useState(false);
  const projectData = project.data ?? EMPTY_PROJECT;
  const types = MODULE_META[project.data?.module ?? 'software'].taskTypes;
  const type = types.includes(fields.type) ? fields.type : types[0]!;
  const cardType = projectData.cardTypes.find((item) => item.id === fields.cardTypeId);
  const customTypes = projectData.cardTypes.length > 0;
  const noun = project.data?.kind === 'household' ? typeLabel({ type, cardType }).toLowerCase() : 'task';
  const mask = projectData.permissions;
  const effectiveStatus = projectData.statuses.some(
    (status) => status.id === fields.statusId && status.workflow === workflowOf(type),
  )
    ? fields.statusId
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={`New ${noun}`}
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
            Create {noun}
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
              patchFields({ statusId: null, labelIds: [], assigneeId: null, cardTypeId: null });
            }}
            searchable
            options={allowed.map((item) => ({
              value: item.key,
              label: item.name,
              description: item.key,
              icon: <ProjectAvatar appearance={item} size="xs" />,
            }))}
            className="h-9"
          />
          {!customTypes && (
            <SegmentedControl
              label="Type"
              size="sm"
              value={type}
              onChange={(type) => patchFields({ type, cardTypeId: null })}
              options={types.map((value) => ({
                value,
                label: TYPE_META[value].label,
                icon: <TypeIcon type={value} />,
              }))}
            />
          )}
        </div>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            type === 'bug'
              ? 'What is broken?'
              : type === 'task' && !cardType
                ? 'Task title'
                : `${typeLabel({ type, cardType })} title`
          }
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
        <TaskCreateFields
          project={projectData}
          values={{ ...fields, type, cardTypeId: cardType?.id ?? null }}
          onChange={patchFields}
          fields={[
            ...(customTypes ? (['type'] as const) : []),
            'status',
            'priority',
            'assignee',
            'dueDate',
            'recurrence',
            'labels',
            'severity',
          ]}
        />
      </form>
    </Modal>
  );
}
