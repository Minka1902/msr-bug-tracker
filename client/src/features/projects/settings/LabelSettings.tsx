import { Plus, Tag, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PROJECT_COLORS } from '../../../lib/projectAppearance';
import { Button } from '../../../components/ui/Button';
import { ColorSwatchPicker } from '../../../components/ui/ColorSwatchPicker';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';
import { InlineText } from '../../../components/ui/InlineText';
import { Input } from '../../../components/ui/Input';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { useCreateLabel, useDeleteLabel, useUpdateLabel } from '../api';
import { useProjectContext } from '../useProjectContext';
import { useProjectPermissions } from '../useProjectPermissions';

const onError = (error: unknown) => toast.error(errorMessage(error));

export function LabelSettings() {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), color }, { onSuccess: () => setName(''), onError });
  };

  const removeLabel = async (id: string, label: string) => {
    if (
      await confirm({
        title: `Delete “${label}”?`,
        description: 'It will be removed from every task.',
        confirmLabel: 'Delete label',
      })
    )
      remove.mutate(id, { onError });
  };

  const project = useProjectContext();
  const { can, deniedReason } = useProjectPermissions(project);
  const confirm = useConfirm();
  const create = useCreateLabel(project.key);
  const update = useUpdateLabel(project.key);
  const remove = useDeleteLabel(project.key);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[16]!);
  const editable = can('project.manage_labels');

  return (
    <SettingsSection
      title="Labels"
      description={editable ? 'Tag tasks to group and filter them.' : deniedReason}
    >
      <div className="flex flex-col gap-3">
        {editable && (
          <form onSubmit={submit} className="flex items-center gap-2">
            <ColorSwatchPicker value={color} onChange={setColor} size="md" label="Label color" />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New label name"
              maxLength={40}
              size="sm"
              wrapperClassName="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              leftIcon={<Plus />}
              loading={create.isPending}
              disabled={!name.trim()}
            >
              Add
            </Button>
          </form>
        )}
        {project.labels.length === 0 && <EmptyState compact icon={<Tag />} title="No labels yet" />}
        <div className="flex flex-col divide-y divide-border">
          {project.labels.map((label) => (
            <div key={label.id} className="flex items-center gap-2 py-1.5">
              <ColorSwatchPicker
                value={label.color}
                disabled={!editable}
                onChange={(next) => update.mutate({ id: label.id, color: next }, { onError })}
              />
              <InlineText
                aria-label="Label name"
                value={label.name}
                maxLength={40}
                disabled={!editable}
                onSave={(next) => update.mutate({ id: label.id, name: next }, { onError })}
              />
              {editable && (
                <IconButton
                  icon={<Trash2 />}
                  label={`Delete ${label.name}`}
                  variant="danger-ghost"
                  onClick={() => removeLabel(label.id, label.name)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
