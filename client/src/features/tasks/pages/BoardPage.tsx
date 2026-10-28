import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Workflow } from '@msr/shared/enums';
import { MODULE_META } from '@msr/shared/modules';
import { FilterBar } from '../../../components/ui/FilterBar';
import { useLocalState } from '../../../hooks/useLocalState';
import { useUrlFilters } from '../../../hooks/useUrlFilters';
import { useProjectContext } from '../../projects/useProjectContext';
import { TaskBoardView } from '../board/TaskBoardView';
import type { GroupBy } from '../board/groupTasks';
import { BoardToolbar } from '../components/BoardToolbar';
import { taskFilterDefs } from '../taskFilterDefs';
import { useTaskOptions } from '../useTaskOptions';
import { useTaskPeek } from '../useTaskPeek';

export function BoardPage() {
  const setWorkflow = (next: Workflow) =>
    setParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('workflow', next);
      return params;
    });

  const project = useProjectContext();
  const peek = useTaskPeek();
  const options = useTaskOptions(project);
  const [params, setParams] = useSearchParams();
  const { filters, update, clear } = useUrlFilters();
  const household = project.kind === 'household';
  const [groupBy, setGroupBy] = useLocalState<GroupBy>(
    `msr-board-group-${project.key}`,
    household ? 'assignee' : 'none',
  );
  const hasBugs = MODULE_META[project.module].taskTypes.includes('bug');
  const workflow = hasBugs && params.get('workflow') === 'bug' ? 'bug' : 'task';
  const defs = useMemo(
    () => taskFilterDefs(options).filter((def) => def.key !== 'status' && (household || def.key !== 'type')),
    [options, household],
  );

  return (
    <div className="flex flex-col gap-3">
      <FilterBar defs={defs} values={filters} onChange={update} onClear={clear}>
        <BoardToolbar
          workflow={hasBugs ? workflow : undefined}
          onWorkflowChange={setWorkflow}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </FilterBar>
      <TaskBoardView
        project={project}
        workflow={workflow}
        filters={filters}
        groupBy={groupBy}
        onOpen={(task) => peek.open(task.identifier)}
      />
    </div>
  );
}
