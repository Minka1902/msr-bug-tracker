import { KanbanSquare, List } from 'lucide-react';
import { useMemo } from 'react';
import { FilterBar } from '../../../components/ui/FilterBar';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useLocalState } from '../../../hooks/useLocalState';
import { useUrlFilters } from '../../../hooks/useUrlFilters';
import { useProjectContext } from '../../projects/useProjectContext';
import { TaskBoardView } from '../board/TaskBoardView';
import type { GroupBy } from '../board/groupTasks';
import { BoardToolbar } from '../components/BoardToolbar';
import { TaskListView } from '../components/TaskListView';
import { taskFilterDefs } from '../taskFilterDefs';
import { useTaskOptions } from '../useTaskOptions';
import { useTaskPeek } from '../useTaskPeek';

export function BugsPage() {
  const project = useProjectContext();
  const peek = useTaskPeek();
  const options = useTaskOptions(project);
  const { filters, update, clear } = useUrlFilters();
  const [mode, setMode] = useLocalState<'list' | 'board'>('msr-bugs-mode', 'list');
  const [groupBy, setGroupBy] = useLocalState<GroupBy>(`msr-bugs-group-${project.key}`, 'none');
  const defs = useMemo(
    () => taskFilterDefs(options, { bugsOnly: true }).filter((def) => def.key !== 'status'),
    [options],
  );
  const switcher = (
    <SegmentedControl
      size="sm"
      label="View"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'list', label: 'List', icon: <List /> },
        { value: 'board', label: 'Board', icon: <KanbanSquare /> },
      ]}
    />
  );

  if (mode === 'list')
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">{switcher}</div>
        <TaskListView project={project} bugsOnly onOpen={(task) => peek.open(task.identifier)} />
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <FilterBar defs={defs} values={filters} onChange={update} onClear={clear}>
        <BoardToolbar groupBy={groupBy} onGroupByChange={setGroupBy} />
        {switcher}
      </FilterBar>
      <TaskBoardView
        project={project}
        workflow="bug"
        filters={filters}
        groupBy={groupBy}
        onOpen={(task) => peek.open(task.identifier)}
      />
    </div>
  );
}
