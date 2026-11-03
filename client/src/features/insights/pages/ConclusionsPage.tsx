import { Gavel, MessagesSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useProjectContext } from '../../projects/useProjectContext';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useConclusions } from '../api';
import { ConclusionCard } from '../components/ConclusionCard';
import { SectionCard } from '../components/SectionCard';
import { TaskLine } from '../components/TaskLine';

const SEARCH_DELAY = 250;

export function ConclusionsPage() {
  const openTask = (task: { identifier: string }) => peek.open(task.identifier);

  const project = useProjectContext();
  const peek = useTaskPeek();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), SEARCH_DELAY);
  const conclusions = useConclusions(project.key, q);
  const pages = conclusions.data?.pages ?? [];
  const decided = pages.flatMap((page) => page.items);
  const open = pages[0]?.open ?? [];

  if (conclusions.error) return <ErrorState error={conclusions.error} onRetry={conclusions.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label="Search decisions"
        placeholder="Search decisions…"
        leftIcon={<Search />}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-md"
      />
      {conclusions.isPending && <Skeleton className="h-28" count={3} />}
      {open.length > 0 && (
        <SectionCard title={`Waiting for a decision (${open.length})`} icon={<MessagesSquare />}>
          <div className="flex flex-col">
            {open.map((task) => (
              <TaskLine key={task.id} task={task} onOpen={openTask} />
            ))}
          </div>
        </SectionCard>
      )}
      {!conclusions.isPending && !decided.length && (
        <EmptyState
          icon={<Gavel />}
          title={q ? 'No decisions match' : 'No decisions yet'}
          description={q ? 'Try other words.' : 'Close a discussion with its decision and it shows up here.'}
        />
      )}
      {decided.map((conclusion) => (
        <ConclusionCard key={conclusion.id} conclusion={conclusion} onOpen={openTask} />
      ))}
      {conclusions.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={conclusions.isFetchingNextPage}
          onClick={() => conclusions.fetchNextPage()}
        >
          Load older decisions
        </Button>
      )}
    </div>
  );
}
