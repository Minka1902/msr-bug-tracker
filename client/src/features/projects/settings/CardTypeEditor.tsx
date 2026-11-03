import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { TYPE_META, type TaskType } from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import { can, type Permission } from '@msr/shared/permissions';
import type { CardType, ProjectDetail } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { CheckboxGroup } from '../../../components/ui/CheckboxGroup';
import { ColorSwatchPicker } from '../../../components/ui/ColorSwatchPicker';
import { Field } from '../../../components/ui/Field';
import { IconPicker } from '../../../components/ui/IconPicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { errorMessage } from '../../../lib/api';
import { PROJECT_COLORS } from '../../../lib/projectAppearance';
import { invalidateTaskData } from '../../tasks/api';
import { TypeIcon } from '../../tasks/taskMeta';
import { useCreateCardType, useUpdateCardType } from '../api';

interface CardTypeEditorProps {
  project: ProjectDetail;
  cardType: CardType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Values {
  name: string;
  icon: string;
  color: string;
  base: TaskType;
  createRoleIds: string[];
  editRoleIds: string[];
  viewRoleIds: string[];
}

type Audience = 'everyone' | 'roles';

const DEFAULT_ICON = 'sparkles';

const rolesWith = (project: ProjectDetail, ...permissions: Permission[]) =>
  project.roles
    .filter((role) => role.systemKey !== 'owner' && permissions.some((key) => can(role.permissions, key)))
    .map((role) => role.id);

const initialValues = (project: ProjectDetail, cardType: CardType | null): Values =>
  cardType
    ? {
        name: cardType.name,
        icon: cardType.icon,
        color: cardType.color,
        base: cardType.base,
        createRoleIds: cardType.createRoleIds,
        editRoleIds: cardType.editRoleIds,
        viewRoleIds: cardType.viewRoleIds,
      }
    : {
        name: '',
        icon: DEFAULT_ICON,
        color: PROJECT_COLORS[2]!,
        base: MODULE_META[project.module].taskTypes[0]!,
        createRoleIds: rolesWith(project, 'task.create'),
        editRoleIds: rolesWith(project, 'task.edit_any', 'task.edit_own'),
        viewRoleIds: [],
      };

const union = (...lists: string[][]) => [...new Set(lists.flat())];

export function CardTypeEditor({ project, cardType, open, onOpenChange }: CardTypeEditorProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;
    const handlers = {
      onSuccess: () => {
        toast.success(cardType ? `${values.name.trim()} saved` : `${values.name.trim()} added`);
        onOpenChange(false);
        return invalidateTaskData(client);
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    };
    if (!cardType) return create.mutate(values, handlers);
    const { name, icon, color, createRoleIds, editRoleIds, viewRoleIds } = values;
    update.mutate({ id: cardType.id, name, icon, color, createRoleIds, editRoleIds, viewRoleIds }, handlers);
  };

  const patch = (next: Partial<Values>) => setValues((current) => ({ ...current, ...next }));

  const grant = (key: 'createRoleIds' | 'editRoleIds', ids: string[]) =>
    setValues((current) => ({
      ...current,
      [key]: ids,
      viewRoleIds: current.viewRoleIds.length ? union(current.viewRoleIds, ids) : [],
    }));

  const setAudience = (audience: Audience) =>
    patch({
      viewRoleIds: audience === 'everyone' ? [] : union(values.createRoleIds, values.editRoleIds, ownerRoles),
    });

  const setViewers = (viewRoleIds: string[]) =>
    patch({
      viewRoleIds,
      createRoleIds: values.createRoleIds.filter((id) => viewRoleIds.includes(id)),
      editRoleIds: values.editRoleIds.filter((id) => viewRoleIds.includes(id)),
    });

  const client = useQueryClient();
  const create = useCreateCardType(project.key);
  const update = useUpdateCardType(project.key);
  const [values, setValues] = useState(() => initialValues(project, cardType));
  const [lastOpen, setLastOpen] = useState(open);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setValues(initialValues(project, cardType));
  }

  const roleOptions = project.roles.map((role) => ({ value: role.id, label: role.name }));
  const ownerRoles = project.roles.filter((role) => role.systemKey === 'owner').map((role) => role.id);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={cardType ? `Edit ${cardType.name}` : 'New card type'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="card-type-form"
            loading={create.isPending || update.isPending}
            disabled={!values.name.trim()}
          >
            {cardType ? 'Save card type' : 'Add card type'}
          </Button>
        </>
      }
    >
      <form id="card-type-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" htmlFor="card-type-name">
          <Input
            id="card-type-name"
            autoFocus
            value={values.name}
            maxLength={40}
            placeholder="Experiment, Interview, Legal…"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>
        <Field label="Color">
          <ColorSwatchPicker
            value={values.color}
            size="md"
            label="Card type color"
            onChange={(color) => patch({ color })}
          />
        </Field>
        <Field label="Icon">
          <IconPicker value={values.icon} color={values.color} onChange={(icon) => patch({ icon })} />
        </Field>
        <Field
          label="Works like"
          hint={
            cardType
              ? "Can't be changed once the type exists."
              : 'Its cards use the statuses and fields of this type.'
          }
        >
          <OptionPicker
            aria-label="Works like"
            value={values.base}
            disabled={!!cardType}
            onChange={(base) => base && patch({ base: base as TaskType })}
            options={MODULE_META[project.module].taskTypes.map((type) => ({
              value: type,
              label: TYPE_META[type].label,
              icon: <TypeIcon type={type} />,
            }))}
          />
        </Field>
        <Field
          label="Who can see them"
          hint="Their assignee and reporter always can. Only roles that see them can create or edit them."
        >
          <SegmentedControl<Audience>
            label="Who can see them"
            value={values.viewRoleIds.length ? 'roles' : 'everyone'}
            onChange={setAudience}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'roles', label: 'Chosen roles' },
            ]}
            className="self-start"
          />
          {values.viewRoleIds.length > 0 && (
            <CheckboxGroup
              options={roleOptions}
              value={values.viewRoleIds}
              lockedValues={ownerRoles}
              onChange={setViewers}
              className="mt-2"
            />
          )}
        </Field>
        <Field label="Who can create them" hint="A role also needs permission to create tasks.">
          <CheckboxGroup
            options={roleOptions}
            value={values.createRoleIds}
            lockedValues={ownerRoles}
            onChange={(ids) => grant('createRoleIds', ids)}
          />
        </Field>
        <Field label="Who can edit and move them" hint="Everyone who can see them can still comment on them.">
          <CheckboxGroup
            options={roleOptions}
            value={values.editRoleIds}
            lockedValues={ownerRoles}
            onChange={(ids) => grant('editRoleIds', ids)}
          />
        </Field>
      </form>
    </Modal>
  );
}
