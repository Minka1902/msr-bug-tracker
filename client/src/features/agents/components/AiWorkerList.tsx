import { Bot, Pencil, Plug, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AiWorker, ConnectedApp } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';
import { TextPromptDialog } from '../../../components/ui/TextPromptDialog';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { useDeleteWorker, useUpdateWorker } from '../api';
import { ConnectWorkerDialog } from './ConnectWorkerDialog';

interface AiWorkerListProps {
  workers: AiWorker[];
  apps: ConnectedApp[];
}

export function AiWorkerList({ workers, apps }: AiWorkerListProps) {
  const rename = (name: string) =>
    renaming &&
    update.mutate(
      { id: renaming.id, name },
      { onSuccess: () => setRenaming(null), onError: (error) => toast.error(errorMessage(error)) },
    );

  const remove = async (worker: AiWorker) => {
    if (
      await confirm({
        title: `Delete ${worker.name}?`,
        description: `${worker.name} leaves all its projects and its connection stops working. Its open tasks become unassigned.`,
        confirmLabel: 'Delete worker',
      })
    )
      deleteWorker.mutate(worker.id, {
        onSuccess: () => toast.success(`${worker.name} deleted`),
        onError: (error) => toast.error(errorMessage(error)),
      });
  };

  const confirm = useConfirm();
  const update = useUpdateWorker();
  const deleteWorker = useDeleteWorker();
  const [renaming, setRenaming] = useState<AiWorker | null>(null);
  const [connecting, setConnecting] = useState<AiWorker | null>(null);

  if (!workers.length)
    return (
      <EmptyState
        compact
        icon={<Bot />}
        title="No AI workers yet"
        description="Turn a connected app into a worker, then add it to a project from its Members settings."
      />
    );

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {workers.map((worker) => (
          <li key={worker.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Avatar name={worker.name} size="md" bot decorative />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{worker.name}</span>
                {worker.connection ? (
                  <Badge size="xs" icon={<Plug />} label={worker.connection.name} />
                ) : (
                  <Badge size="xs" tone="warning" label="Not connected" />
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {worker.projects.length
                  ? worker.projects.map((project) => `${project.key} · ${project.role}`).join(', ')
                  : 'Not in any project yet'}
              </p>
            </div>
            {!worker.connection && (
              <Button size="sm" variant="soft" onClick={() => setConnecting(worker)}>
                Connect
              </Button>
            )}
            <IconButton
              icon={<Pencil />}
              label={`Rename ${worker.name}`}
              onClick={() => setRenaming(worker)}
            />
            <IconButton
              icon={<Trash2 />}
              label={`Delete ${worker.name}`}
              variant="danger-ghost"
              onClick={() => remove(worker)}
            />
          </li>
        ))}
      </ul>
      <TextPromptDialog
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename AI worker"
        label="Name"
        maxLength={80}
        initialValue={renaming?.name}
        loading={update.isPending}
        onSubmit={rename}
      />
      {connecting && (
        <ConnectWorkerDialog
          open
          onOpenChange={(open) => !open && setConnecting(null)}
          apps={apps}
          worker={connecting}
        />
      )}
    </>
  );
}
