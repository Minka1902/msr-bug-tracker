import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { CreateTaskInput } from '@msr/shared/schemas/task';
import { Button } from '../../../components/ui/Button';
import { errorMessage } from '../../../lib/api';
import { useCreateTask } from '../api';

interface InlineTaskComposerProps {
  projectKey: string;
  defaults: Omit<CreateTaskInput, 'title'>;
}

export function InlineTaskComposer({ projectKey, defaults }: InlineTaskComposerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    setTitle('');
    create.mutate(
      { projectKey, title: text, ...defaults },
      {
        onError: (error) => {
          setTitle(text);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const create = useCreateTask();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  if (!open)
    return (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Plus />}
        onClick={() => setOpen(true)}
        className="justify-start border-dashed bg-transparent text-muted shadow-none"
      >
        Add task
      </Button>
    );

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-[calc(var(--r-card)-4px)] border border-accent/50 bg-surface-raised p-2 shadow-card"
    >
      <textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={300}
        placeholder="Task title, then press Enter"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) submit(event);
          if (event.key === 'Escape') setOpen(false);
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-subtle"
      />
      <div className="flex justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="xs" type="submit" loading={create.isPending} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}
