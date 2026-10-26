import { Drawer } from '../../../components/ui/Drawer';
import { Sheet } from '../../../components/ui/Sheet';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PHONE } from '../../../lib/media';
import { TaskDetail } from '../detail/TaskDetail';
import { useTaskPeek } from '../useTaskPeek';

export function TaskPeek() {
  const { identifier, open, close } = useTaskPeek();
  const phone = useMediaQuery(PHONE);
  const detail = identifier && (
    <TaskDetail key={identifier} identifier={identifier} onClose={close} onNavigate={open} />
  );

  if (phone)
    return (
      <Sheet
        open={!!identifier}
        onOpenChange={(next) => !next && close()}
        title={identifier ?? 'Task'}
        titleHidden
        hideClose
        full
        bodyClassName="flex flex-col overflow-hidden px-0 pb-0"
      >
        {detail}
      </Sheet>
    );

  return (
    <Drawer
      open={!!identifier}
      onOpenChange={(next) => !next && close()}
      title={identifier ?? 'Task'}
      width={820}
      modal={false}
      className="border-l"
    >
      {detail}
    </Drawer>
  );
}
