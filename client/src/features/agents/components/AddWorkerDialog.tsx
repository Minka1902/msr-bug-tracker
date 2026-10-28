import { Bot } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { isSubsetOf } from '@msr/shared/permissions';
import type { ProjectDetail } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Skeleton } from '../../../components/ui/Skeleton';
import { errorMessage } from '../../../lib/api';
import { useAddWorkerToProject, useWorkers } from '../api';

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Pick<ProjectDetail, 'key' | 'name' | 'roles' | 'permissions' | 'memberList'>;
}

export function AddWorkerDialog({ open, onOpenChange, project }: AddWorkerDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!workerId || !chosenRole) return;
    add.mutate(
      { agentId: workerId, roleId: chosenRole },
      {
        onSuccess: ({ member }) => {
          toast.success(`${member.name} joined ${project.name}`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const workers = useWorkers();
  const add = useAddWorkerToProject(project.key);
  const available = (workers.data ?? []).filter(
    (worker) => !project.memberList.some((member) => member.id === worker.id),
  );
  const roles = project.roles.filter(
    (role) => role.systemKey !== 'owner' && isSubsetOf(role.permissions, project.permissions),
  );
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const chosenRole = roleId ?? roles.find((role) => role.systemKey === 'member')?.id ?? null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add AI worker"
      description={`It works in ${project.name} with the role you pick, and you can assign it tasks.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-worker" loading={add.isPending} disabled={!workerId || !chosenRole}>
            Add worker
          </Button>
        </>
      }
    >
      {workers.isPending ? (
        <Skeleton className="h-24" />
      ) : available.length ? (
        <form id="add-worker" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="AI worker">
            <OptionPicker
              aria-label="AI worker"
              value={workerId}
              onChange={setWorkerId}
              placeholder="Pick a worker"
              options={available.map((worker) => ({
                value: worker.id,
                label: worker.name,
                description: worker.connection?.name ?? 'Not connected',
                icon: <Avatar name={worker.name} size="xs" bot decorative />,
              }))}
              className="w-full"
            />
          </Field>
          <Field label="Role">
            <OptionPicker
              aria-label="Role"
              value={chosenRole}
              onChange={setRoleId}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              className="w-full"
            />
          </Field>
        </form>
      ) : (
        <EmptyState
          compact
          icon={<Bot />}
          title={workers.data?.length ? 'All your AI workers are here' : 'No AI workers yet'}
          description="Connect your AI app, then turn it into a worker in Settings → Connected apps."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/settings/connected-apps">Open Connected apps</Link>
            </Button>
          }
        />
      )}
    </Modal>
  );
}
