import { Drawer } from '../../../components/ui/Drawer';
import { TaskDetail } from '../detail/TaskDetail';
import { useTaskPeek } from '../useTaskPeek';

export function TaskPeek() {
  const { identifier, open, close } = useTaskPeek();

  return (
    <Drawer
      open={!!identifier}
      onOpenChange={(next) => !next && close()}
      title={identifier ?? 'Task'}
      width={820}
      modal={false}
      className="border-l"
    >
      {identifier && (
        <TaskDetail key={identifier} identifier={identifier} onClose={close} onNavigate={open} />
      )}
    </Drawer>
  );
}
