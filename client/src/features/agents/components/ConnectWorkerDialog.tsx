import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { AiWorker, ConnectedApp } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { errorMessage } from '../../../lib/api';
import { useCreateWorker, useUpdateWorker } from '../api';

interface ConnectWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: ConnectedApp[];
  worker?: AiWorker;
  initialGrantId?: string;
}

export function ConnectWorkerDialog({
  open,
  onOpenChange,
  apps,
  worker,
  initialGrantId,
}: ConnectWorkerDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!grantId || !name.trim()) return;
    const done = {
      onSuccess: () => {
        toast.success(`${name.trim()} is ready to work`);
        onOpenChange(false);
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    };
    if (worker) update.mutate({ id: worker.id, grantId, name: name.trim() }, done);
    else create.mutate({ grantId, name: name.trim() }, done);
  };

  const pick = (next: string | null) => {
    setGrantId(next);
    const app = free.find((item) => item.id === next);
    if (app && !nameTouched) setName(`${app.name} worker`);
  };

  const create = useCreateWorker();
  const update = useUpdateWorker();
  const free = apps.filter((app) => !app.worker);
  const first = free.find((app) => app.id === initialGrantId) ?? free[0];
  const [grantId, setGrantId] = useState<string | null>(first?.id ?? null);
  const [name, setName] = useState(worker?.name ?? (first ? `${first.name} worker` : ''));
  const [nameTouched, setNameTouched] = useState(!!worker);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={worker ? `Connect ${worker.name}` : 'New AI worker'}
      description="Add it to projects with a role, then assign it tasks."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="connect-worker"
            loading={create.isPending || update.isPending}
            disabled={!grantId || !name.trim()}
          >
            {worker ? 'Connect' : 'Create worker'}
          </Button>
        </>
      }
    >
      <form id="connect-worker" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Connected app">
          <OptionPicker
            aria-label="Connected app"
            value={grantId}
            onChange={pick}
            placeholder="Pick a connected app"
            emptyText="Every connected app is already a worker. Connect your AI app again first."
            options={free.map((app) => ({ value: app.id, label: app.name, description: app.host }))}
            className="w-full"
          />
        </Field>
        <Field label="Worker name" htmlFor="worker-name">
          <Input
            id="worker-name"
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              setNameTouched(true);
            }}
          />
        </Field>
        <Banner tone="warning" icon={<TriangleAlert />}>
          From now on this connection works as the AI worker: it only sees the projects you add it to, with
          the role you give it there. To use the app as yourself too, connect it again.
        </Banner>
      </form>
    </Modal>
  );
}
