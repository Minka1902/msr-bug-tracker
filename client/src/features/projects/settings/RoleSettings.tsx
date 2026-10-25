import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { can, isSubsetOf, PERMISSIONS, type Permission } from '@msr/shared/permissions';
import type { ProjectRole } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { Menu } from '../../../components/ui/Menu';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { PermissionMatrix, type MatrixRole } from '../../../components/ui/PermissionMatrix';
import { errorMessage } from '../../../lib/api';
import { useCreateRole, useDeleteRole, useUpdateRole } from '../api';
import { useProjectContext } from '../useProjectContext';
import { useProjectPermissions } from '../useProjectPermissions';

type Dialog =
  | { kind: 'create'; cloneFrom: ProjectRole | null }
  | { kind: 'rename'; role: ProjectRole }
  | { kind: 'delete'; role: ProjectRole }
  | null;

const onError = (error: unknown) => toast.error(errorMessage(error));

export function RoleSettings() {
  const toggle = (role: MatrixRole, permission: Permission, next: boolean) =>
    update.mutate(
      {
        id: role.id,
        permissions: next
          ? role.permissions | PERMISSIONS[permission]
          : role.permissions & ~PERMISSIONS[permission],
      },
      { onError },
    );

  const canToggle = (role: MatrixRole, permission: Permission) =>
    manageable && isSubsetOf(role.permissions, project.permissions) && can(project.permissions, permission);

  const openDialog = (next: Dialog) => {
    setDialog(next);
    setName(
      next?.kind === 'rename'
        ? next.role.name
        : next?.kind === 'create' && next.cloneFrom
          ? `${next.cloneFrom.name} copy`
          : '',
    );
    setReassignTo(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const done = { onSuccess: () => setDialog(null), onError };
    if (dialog?.kind === 'create')
      create.mutate(
        { name: name.trim(), permissions: (dialog.cloneFrom?.permissions ?? 0) & project.permissions },
        done,
      );
    if (dialog?.kind === 'rename') update.mutate({ id: dialog.role.id, name: name.trim() }, done);
    if (dialog?.kind === 'delete' && reassignId)
      remove.mutate({ id: dialog.role.id, reassignToRoleId: reassignId }, done);
  };

  const project = useProjectContext();
  const { can: allowed, deniedReason } = useProjectPermissions(project);
  const create = useCreateRole(project.key);
  const update = useUpdateRole(project.key);
  const remove = useDeleteRole(project.key);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const manageable = allowed('project.manage_roles');
  const reassignOptions = project.roles
    .filter((role) => role.systemKey !== 'owner' && (dialog?.kind !== 'delete' || role.id !== dialog.role.id))
    .map((role) => ({ value: role.id, label: role.name }));
  const reassignId = reassignTo ?? project.roles.find((role) => role.systemKey === 'viewer')?.id ?? null;

  const matrixRoles: MatrixRole[] = project.roles.map((role) => ({
    ...role,
    locked: role.systemKey === 'owner',
    header: (
      <span className="flex items-center gap-1">
        {role.name}
        <span className="text-xs font-normal text-subtle">({role.memberCount})</span>
        {manageable && role.systemKey !== 'owner' && (
          <Menu
            trigger={
              <IconButton
                icon={<MoreHorizontal />}
                label={`${role.name} options`}
                size="xs"
                tooltip={false}
              />
            }
            items={[
              {
                label: 'Duplicate',
                icon: <Copy />,
                onSelect: () => openDialog({ kind: 'create', cloneFrom: role }),
              },
              {
                label: 'Rename',
                icon: <Pencil />,
                hidden: !!role.systemKey,
                onSelect: () => openDialog({ kind: 'rename', role }),
              },
              {
                label: 'Delete',
                icon: <Trash2 />,
                danger: true,
                hidden: !!role.systemKey,
                onSelect: () => openDialog({ kind: 'delete', role }),
              },
            ]}
          />
        )}
      </span>
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Banner tone="info" className="flex-1">
          Roles decide what members can do in this project. Changes apply immediately.{' '}
          {!manageable && `${deniedReason}.`}
        </Banner>
        {manageable && (
          <Button leftIcon={<Plus />} onClick={() => openDialog({ kind: 'create', cloneFrom: null })}>
            New role
          </Button>
        )}
      </div>
      <PermissionMatrix roles={matrixRoles} canToggle={canToggle} onToggle={toggle} />
      <Modal
        open={!!dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        size="sm"
        title={
          dialog?.kind === 'create'
            ? 'New role'
            : dialog?.kind === 'rename'
              ? 'Rename role'
              : `Delete “${dialog?.role.name}”?`
        }
        description={dialog?.kind === 'delete' ? 'Its members will move to the role you pick.' : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="role-form"
              variant={dialog?.kind === 'delete' ? 'danger' : 'primary'}
              loading={create.isPending || update.isPending || remove.isPending}
              disabled={dialog?.kind === 'delete' ? !reassignId : !name.trim()}
            >
              {dialog?.kind === 'create' ? 'Create role' : dialog?.kind === 'rename' ? 'Save' : 'Delete role'}
            </Button>
          </>
        }
      >
        <form id="role-form" onSubmit={submit}>
          {dialog?.kind === 'delete' ? (
            <Field label="Move members to">
              <OptionPicker
                aria-label="Move members to"
                value={reassignId}
                onChange={setReassignTo}
                options={reassignOptions}
                className="w-full"
              />
            </Field>
          ) : (
            <Field
              label="Role name"
              hint={
                dialog?.kind === 'create' && !dialog.cloneFrom
                  ? 'New roles start with no permissions.'
                  : undefined
              }
            >
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="QA, Reporter, Contractor…"
              />
            </Field>
          )}
        </form>
      </Modal>
    </div>
  );
}
