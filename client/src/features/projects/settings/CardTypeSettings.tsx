import { useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { TYPE_META } from '@msr/shared/enums';
import { CARD_TYPES_MAX } from '@msr/shared/modules';
import type { CardType } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { SettingsSection } from '../../settings/components/SettingsSection';
import { invalidateTaskData } from '../../tasks/api';
import { TypeIcon } from '../../tasks/taskMeta';
import { useDeleteCardType } from '../api';
import { useProjectContext } from '../useProjectContext';
import { CardTypeEditor } from './CardTypeEditor';

const DESCRIPTION =
  'Add your own kinds of cards, like Experiment or Interview, and choose which roles can create and edit them.';

export function CardTypeSettings() {
  const openEditor = (cardType: CardType | null) => {
    setEditing(cardType);
    setEditorOpen(true);
  };

  const removeType = async (cardType: CardType) => {
    if (
      await confirm({
        title: `Delete “${cardType.name}”?`,
        description: `Its cards become ${TYPE_META[cardType.base].label} cards again.`,
        confirmLabel: 'Delete card type',
      })
    )
      remove.mutate(cardType.id, {
        onSuccess: () => invalidateTaskData(client),
        onError: (error) => toast.error(errorMessage(error)),
      });
  };

  const roleNames = (ids: string[]) =>
    project.roles
      .filter((role) => role.systemKey === 'owner' || ids.includes(role.id))
      .map((role) => role.name)
      .join(', ');

  const project = useProjectContext();
  const confirm = useConfirm();
  const client = useQueryClient();
  const remove = useDeleteCardType(project.key);
  const [editing, setEditing] = useState<CardType | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  if (!project.cardTypesAllowed)
    return (
      <SettingsSection title="Card types" description={DESCRIPTION}>
        <EmptyState
          icon={<Lock />}
          title="Needs the Pro plan"
          description="Pro adds custom card types to every project. Startup projects always have them."
          action={
            <Button size="sm" asChild>
              <Link to="/shop">See plans</Link>
            </Button>
          }
        />
      </SettingsSection>
    );

  return (
    <SettingsSection title="Card types" description={DESCRIPTION}>
      <div className="flex flex-col gap-3">
        <Button
          size="sm"
          leftIcon={<Plus />}
          onClick={() => openEditor(null)}
          disabled={project.cardTypes.length >= CARD_TYPES_MAX}
          className="self-start"
        >
          Add card type
        </Button>
        {project.cardTypes.length === 0 && <EmptyState compact icon={<Shapes />} title="No card types yet" />}
        <div className="flex flex-col divide-y divide-border">
          {project.cardTypes.map((cardType) => (
            <div key={cardType.id} className="flex items-center gap-3 py-2">
              <TypeIcon type={cardType.base} cardType={cardType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cardType.name}</p>
                <p className="text-xs text-muted">
                  Works like {TYPE_META[cardType.base].label} · Create: {roleNames(cardType.createRoleIds)} ·
                  Edit: {roleNames(cardType.editRoleIds)}
                </p>
              </div>
              <IconButton
                icon={<Pencil />}
                label={`Edit ${cardType.name}`}
                onClick={() => openEditor(cardType)}
              />
              <IconButton
                icon={<Trash2 />}
                label={`Delete ${cardType.name}`}
                variant="danger-ghost"
                onClick={() => removeType(cardType)}
              />
            </div>
          ))}
        </div>
      </div>
      <CardTypeEditor project={project} cardType={editing} open={editorOpen} onOpenChange={setEditorOpen} />
    </SettingsSection>
  );
}
