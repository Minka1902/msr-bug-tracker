import { MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PLACE_CATEGORIES, PLACE_CATEGORY_META, type PlaceCategory } from '@msr/shared/places';
import type { CreatePlaceInput } from '@msr/shared/schemas/place';
import type { Place } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { tabListVariants, tabVariants } from '../../../components/ui/Tabs';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { useProjectContext } from '../../projects/useProjectContext';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { PlaceCard } from '../components/PlaceCard';
import { PlaceFormModal } from '../components/PlaceFormModal';
import { useDeletePlace, usePlaces, useSavePlace } from '../placesApi';

const ALL = 'all' as const;
const SEARCHED: (keyof Place)[] = ['name', 'contactName', 'address', 'city', 'phone', 'phoneAlt', 'notes'];

const matches = (place: Place, query: string) =>
  SEARCHED.some((field) => String(place[field]).toLowerCase().includes(query));

type Editing = { place: Place | null } | null;

export function PlacesPage() {
  const onError = { onError: (error: Error) => toast.error(errorMessage(error)) };

  const save = (input: CreatePlaceInput) =>
    savePlace.mutate(editing?.place ? { id: editing.place.id, input } : { input }, {
      onSuccess: () => setEditing(null),
      ...onError,
    });

  const remove = async (place: Place) => {
    if (!(await confirm({ title: `Delete ${place.name}?`, confirmLabel: 'Delete place' }))) return;
    deletePlace.mutate(place.id, { onSuccess: () => setEditing(null), ...onError });
  };

  const project = useProjectContext();
  const permissions = useProjectPermissions(project);
  const confirm = useConfirm();
  const places = usePlaces(project.key);
  const savePlace = useSavePlace(project.key);
  const deletePlace = useDeletePlace(project.key);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PlaceCategory | typeof ALL>(ALL);
  const [editing, setEditing] = useState<Editing>(null);

  if (places.isPending) return <Skeleton className="h-64 w-full" />;
  if (places.error) return <ErrorState error={places.error} onRetry={places.refetch} />;

  const canEdit = permissions.can('lists.edit');
  const search = query.trim().toLowerCase();
  const used = PLACE_CATEGORIES.filter((item) => places.data.some((place) => place.category === item));
  const shown = places.data.filter(
    (place) => (category === ALL || place.category === category) && (!search || matches(place, search)),
  );
  const addButton = canEdit && (
    <Button leftIcon={<Plus />} onClick={() => setEditing({ place: null })}>
      Add place
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {places.data.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              aria-label="Search places"
              placeholder="Search places"
              leftIcon={<Search />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              wrapperClassName="min-w-0 flex-1"
            />
            {addButton}
          </div>
          {used.length > 1 && (
            <div role="group" aria-label="Categories" className={tabListVariants({ variant: 'pill' })}>
              {[ALL, ...used].map((item: PlaceCategory | typeof ALL) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={item === category}
                  data-state={item === category ? 'active' : 'inactive'}
                  onClick={() => setCategory(item)}
                  className={tabVariants({ variant: 'pill' })}
                >
                  {item === ALL ? 'All' : PLACE_CATEGORY_META[item].label}
                </button>
              ))}
            </div>
          )}
          {shown.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {shown.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  canEdit={canEdit}
                  onEdit={(item) => setEditing({ place: item })}
                  onToggleFavorite={(item) =>
                    savePlace.mutate({ id: item.id, input: { isFavorite: !item.isFavorite } }, onError)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={<Search />}
              title="No places match"
              description="Try another word or category."
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<MapPin />}
          title="No places yet"
          description="Keep the doctor, the school, the plumber and every address your family needs in one place."
          action={addButton}
        />
      )}
      {editing && (
        <PlaceFormModal
          open
          place={editing.place}
          saving={savePlace.isPending}
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}
