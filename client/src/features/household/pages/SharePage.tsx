import { House, Link2, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { parseSharedLink } from '@msr/shared/sharedLink';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Skeleton } from '../../../components/ui/Skeleton';
import { errorMessage } from '../../../lib/api';
import { useProjects } from '../../projects/api';
import { linkLabel } from '../linkLabel';
import { useAddItem, useShoppingLists } from '../shoppingApi';

const paramOf = (params: URLSearchParams, name: string) => params.get(name) ?? undefined;

export function SharePage() {
  const add = () =>
    list &&
    addItem.mutate(
      { listId: list.id, name: name.trim(), quantity: '', url: shared.url },
      {
        onSuccess: () => navigate(`/p/${key}/shopping?list=${list.id}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const shared = useMemo(
    () =>
      parseSharedLink({
        title: paramOf(params, 'title'),
        text: paramOf(params, 'text'),
        url: paramOf(params, 'url'),
      }),
    [params],
  );
  const [name, setName] = useState(shared.name);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const projects = useProjects();
  const households = (projects.data ?? []).filter(
    (project) => project.kind === 'household' && !project.isArchived,
  );
  const key = projectKey ?? households[0]?.key ?? '';
  const lists = useShoppingLists(key, false, !!key);
  const addItem = useAddItem(key);
  const list = lists.data?.find((item) => item.id === listId) ?? lists.data?.[0];

  if (projects.isPending) return <Skeleton className="mx-auto mt-4 h-72 w-full max-w-lg" />;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pt-2">
      <h1 className="text-xl font-bold">Add to a shopping list</h1>
      {households.length ? (
        <Card className="flex flex-col gap-3">
          <Field label="Item" htmlFor="share-name">
            <Input
              id="share-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {shared.url && (
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <Link2 className="size-4 shrink-0" />
              <span className="truncate">Link from {linkLabel(shared.url)}</span>
            </p>
          )}
          <Field label="Household">
            <OptionPicker
              aria-label="Household"
              value={key}
              onChange={(value) => {
                if (!value) return;
                setProjectKey(value);
                setListId(null);
              }}
              options={households.map((project) => ({
                value: project.key,
                label: project.name,
                icon: <House />,
              }))}
              className="w-full"
            />
          </Field>
          <Field label="List">
            <OptionPicker
              aria-label="List"
              value={list?.id ?? null}
              onChange={(value) => value && setListId(value)}
              options={(lists.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
              placeholder={lists.isPending ? 'Loading…' : 'No lists yet'}
              className="w-full"
            />
          </Field>
          <Button
            leftIcon={<ShoppingCart />}
            onClick={add}
            loading={addItem.isPending}
            disabled={!list || !name.trim()}
          >
            Add to list
          </Button>
        </Card>
      ) : (
        <EmptyState
          icon={<House />}
          title="No household yet"
          description="Shared products go to a household's shopping list. Create a household first."
          action={
            <Button asChild variant="secondary">
              <Link to="/projects">Go to projects</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
