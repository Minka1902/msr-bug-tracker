import { useProjectContext } from '../../projects/useProjectContext';
import { TaskListView } from '../components/TaskListView';
import { useTaskPeek } from '../useTaskPeek';

export function ListPage({ bugsOnly = false }: { bugsOnly?: boolean }) {
  const project = useProjectContext();
  const peek = useTaskPeek();

  return <TaskListView project={project} bugsOnly={bugsOnly} onOpen={(task) => peek.open(task.identifier)} />;
}
