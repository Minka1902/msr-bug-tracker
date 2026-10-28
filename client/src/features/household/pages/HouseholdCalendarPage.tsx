import { CalendarView } from '../../calendar/components/CalendarView';
import { useProjectContext } from '../../projects/useProjectContext';

export function HouseholdCalendarPage() {
  const project = useProjectContext();

  return (
    <CalendarView
      projectKey={project.key}
      lockTarget
      appointments={project.module === 'household'}
      storageKey="msr-household-calendar-mode"
    />
  );
}
