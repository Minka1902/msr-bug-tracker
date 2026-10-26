import { CircleCheck, ListPlus, MoreHorizontal, Pencil, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { IconButton } from '../../../components/ui/IconButton';
import { Menu } from '../../../components/ui/Menu';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TextPromptDialog } from '../../../components/ui/TextPromptDialog';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { useProjectContext } from '../../projects/useProjectContext';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { QuickAddItem } from '../components/QuickAddItem';
import { ShoppingListItem } from '../components/ShoppingListItem';
import {
  useAddItem,
  useClearChecked,
  useCreateList,
  useDeleteList,
  useRemoveItem,
  useRenameList,
  useShoppingLists,
  useUpdateItem,
} from '../shoppingApi';

type Prompt = { mode: 'create' } | { mode: 'rename'; listId: string; name: string } | null;

export function ShoppingPage() {
  const onError = { onError: (error: Error) => toast.error(errorMessage(error)) };

  const submitPrompt = (name: string) => {
    if (prompt?.mode === 'rename')
      rename.mutate({ listId: prompt.listId, name }, { onSuccess: () => setPrompt(null), ...onError });
    else
      create.mutate(name, {
        onSuccess: (list) => {
          setPrompt(null);
          if (list) setSelectedId(list.id);
        },
        ...onError,
      });
  };

  const removeList = async (listId: string, name: string) => {
    if (
      !(await confirm({
        title: `Delete ${name}?`,
        description: 'All its items are deleted too.',
        confirmLabel: 'Delete list',
      }))
    )
      return;
    remove.mutate(listId, { onSuccess: () => setSelectedId(null), ...onError });
  };

  const project = useProjectContext();
  const permissions = useProjectPermissions(project);
  const confirm = useConfirm();
  const lists = useShoppingLists(project.key);
  const create = useCreateList(project.key);
  const rename = useRenameList(project.key);
  const remove = useDeleteList(project.key);
  const addItem = useAddItem(project.key);
  const updateItem = useUpdateItem(project.key);
  const removeItem = useRemoveItem(project.key);
  const clearChecked = useClearChecked(project.key);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const canEdit = permissions.can('lists.edit');
  const list = lists.data?.find((item) => item.id === selectedId) ?? lists.data?.[0];
  const checkedCount = list?.items.filter((item) => item.isChecked).length ?? 0;

  if (lists.error) return <ErrorState error={lists.error} onRetry={lists.refetch} />;
  if (lists.isPending) return <Skeleton className="h-96 rounded-card" />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {lists.data.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === list?.id}
            onClick={() => setSelectedId(item.id)}
            className="h-8 cursor-pointer rounded-full border border-border bg-surface px-3.5 text-sm text-muted transition-colors hover:text-text aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-contrast"
          >
            {item.name}
            <span className="ml-1.5 tabular-nums opacity-70">
              {item.items.filter((entry) => !entry.isChecked).length}
            </span>
          </button>
        ))}
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<ListPlus />}
            onClick={() => setPrompt({ mode: 'create' })}
          >
            New list
          </Button>
        )}
      </div>
      {!list ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart />}
            title="No shopping lists yet"
            description="Make a list for groceries, the hardware store or anything else."
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate font-semibold">{list.name}</h2>
            {canEdit && checkedCount > 0 && (
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<CircleCheck />}
                loading={clearChecked.isPending}
                onClick={() => clearChecked.mutate(list.id, onError)}
              >
                Clear {checkedCount} checked
              </Button>
            )}
            {canEdit && (
              <Menu
                trigger={<IconButton icon={<MoreHorizontal />} label="List options" />}
                items={[
                  {
                    label: 'Rename',
                    icon: <Pencil />,
                    onSelect: () => setPrompt({ mode: 'rename', listId: list.id, name: list.name }),
                  },
                  {
                    label: 'Delete list',
                    icon: <Trash2 />,
                    danger: true,
                    onSelect: () => removeList(list.id, list.name),
                  },
                ]}
              />
            )}
          </div>
          {canEdit && (
            <div className="border-b border-border p-3">
              <QuickAddItem onAdd={(item) => addItem.mutate({ listId: list.id, ...item }, onError)} />
            </div>
          )}
          {list.items.length ? (
            <ul className="divide-y divide-border">
              {list.items.map((item) => (
                <ShoppingListItem
                  key={item.id}
                  item={item}
                  disabled={!canEdit}
                  onToggle={(isChecked) =>
                    updateItem.mutate({ listId: list.id, itemId: item.id, patch: { isChecked } }, onError)
                  }
                  onRemove={() => removeItem.mutate({ listId: list.id, itemId: item.id }, onError)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ShoppingCart />}
              title="The list is empty"
              description="Add what you need above."
            />
          )}
        </Card>
      )}
      <TextPromptDialog
        open={!!prompt}
        onOpenChange={(open) => !open && setPrompt(null)}
        title={prompt?.mode === 'rename' ? 'Rename list' : 'New list'}
        label="List name"
        placeholder="Hardware store"
        initialValue={prompt?.mode === 'rename' ? prompt.name : ''}
        confirmLabel={prompt?.mode === 'rename' ? 'Save' : 'Create list'}
        maxLength={60}
        loading={create.isPending || rename.isPending}
        onSubmit={submitPrompt}
      />
    </div>
  );
}
