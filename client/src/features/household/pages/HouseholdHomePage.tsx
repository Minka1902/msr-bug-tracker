import { addDays, format } from 'date-fns';
import { CalendarClock, CalendarDays, PartyPopper, Plus, ShoppingCart, SprayCan } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { CalendarItem, TaskCard } from '@msr/shared/types';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCalendarItems } from '../../calendar/api';
import { dayKey } from '../../calendar/calendarDates';
import { AgendaList } from '../../calendar/components/AgendaList';
import { EventModal } from '../../calendar/components/EventModal';
import { UpcomingConflictsBanner } from '../../calendar/components/UpcomingConflictsBanner';
import { SectionCard } from '../../insights/components/SectionCard';
import { useProjectContext } from '../../projects/useProjectContext';
import { useTaskList } from '../../tasks/api';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { TaskSwipeRow } from '../../tasks/components/TaskSwipeRow';
import { ChoreCheckRow } from '../components/ChoreCheckRow';
import { UpcomingAppointments } from '../components/UpcomingAppointments';
import { useShoppingLists } from '../shoppingApi';

const UPCOMING_DAYS = 7;
const APPOINTMENT_DAYS = 14;
const SHOPPING_PREVIEW = 4;
const ANYONE = '__anyone__';

export function HouseholdHomePage() {
  const openTask = (task: TaskCard) => peek.open(task.identifier);

  const openItem = (item: CalendarItem) => {
    if (item.kind === 'task' && item.taskIdentifier) peek.open(item.taskIdentifier);
    else {
      setEvent(item);
      setAddingAppointment(false);
      setEventOpen(true);
    }
  };

  const addAppointment = () => {
    setEvent(null);
    setAddingAppointment(true);
    setEventOpen(true);
  };

  const project = useProjectContext();
  const peek = useTaskPeek();
  const [event, setEvent] = useState<CalendarItem | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [addingAppointment, setAddingAppointment] = useState(false);
  const now = new Date();
  const today = dayKey(now);
  const weekEnd = dayKey(addDays(new Date(), UPCOMING_DAYS - 1));
  const due = useTaskList(
    { projectKey: project.key },
    { dueTo: today, hideDone: 'true', sort: 'due', dir: 'asc' },
  );
  const upcoming = useCalendarItems(today, weekEnd, project.key);
  const appointments = useCalendarItems(
    today,
    dayKey(addDays(new Date(), APPOINTMENT_DAYS - 1)),
    project.key,
  );
  const lists = useShoppingLists(project.key, false);
  const tasks = due.data?.pages.flatMap((page) => page.items) ?? [];
  const groups = [
    ...project.memberList.map((member) => ({
      key: member.id,
      member,
      tasks: tasks.filter((task) => task.assignee?.id === member.id),
    })),
    { key: ANYONE, member: null, tasks: tasks.filter((task) => !task.assignee) },
  ].filter((group) => group.tasks.length);

  return (
    <div className="flex flex-col gap-5">
      <UpcomingConflictsBanner />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard
          title={`Today · ${format(new Date(), 'EEEE, MMMM d')}`}
          icon={<SprayCan />}
          action={
            <Button asChild size="xs" variant="ghost">
              <Link to={`/p/${project.key}/board`}>All chores</Link>
            </Button>
          }
        >
          {due.error && <ErrorState error={due.error} onRetry={due.refetch} />}
          {due.isPending && <Skeleton className="h-10" count={4} />}
          {due.data && !groups.length && (
            <EmptyState
              icon={<PartyPopper />}
              title="All done for today"
              description="Nothing is due or overdue."
            />
          )}
          {groups.map((group) => (
            <section
              key={group.key}
              aria-label={group.member?.name ?? 'Anyone'}
              className="flex flex-col gap-0.5"
            >
              <h3 className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold text-muted">
                {group.member ? (
                  <Avatar name={group.member.name} src={group.member.avatarUrl} size="xs" decorative />
                ) : null}
                {group.member?.name ?? 'Anyone'}
                <span className="font-normal text-subtle">{group.tasks.length}</span>
              </h3>
              {group.tasks.map((task) => (
                <TaskSwipeRow key={task.id} task={task}>
                  <ChoreCheckRow task={task} project={project} onOpen={openTask} />
                </TaskSwipeRow>
              ))}
            </section>
          ))}
        </SectionCard>
        <div className="flex flex-col gap-5">
          <SectionCard
            title="Shopping"
            icon={<ShoppingCart />}
            action={
              <Button asChild size="xs" variant="ghost">
                <Link to={`/p/${project.key}/shopping`}>Open</Link>
              </Button>
            }
          >
            {lists.isPending && <Skeleton className="h-16" />}
            {lists.data?.map((list) => {
              const open = list.items.filter((item) => !item.isChecked);
              return (
                <div key={list.id} className="flex flex-col gap-1">
                  <p className="flex items-center justify-between text-sm font-medium">
                    {list.name}
                    <span className="text-xs font-normal text-muted">{open.length} to buy</span>
                  </p>
                  {open.length > 0 && (
                    <p className="truncate text-xs text-muted">
                      {open
                        .slice(0, SHOPPING_PREVIEW)
                        .map((item) => item.name)
                        .join(', ')}
                      {open.length > SHOPPING_PREVIEW && ` +${open.length - SHOPPING_PREVIEW}`}
                    </p>
                  )}
                </div>
              );
            })}
          </SectionCard>
          <SectionCard
            title="Appointments"
            icon={<CalendarClock />}
            action={
              <Button size="xs" variant="ghost" leftIcon={<Plus />} onClick={addAppointment}>
                Add
              </Button>
            }
          >
            {appointments.isPending ? (
              <Skeleton className="h-16" />
            ) : (
              <UpcomingAppointments
                items={(appointments.data ?? []).filter(
                  (item) => item.appointment && new Date(item.endsAt) > now,
                )}
                onOpen={openItem}
              />
            )}
          </SectionCard>
          <SectionCard
            title="This week"
            icon={<CalendarDays />}
            action={
              <Button asChild size="xs" variant="ghost">
                <Link to={`/p/${project.key}/calendar`}>Calendar</Link>
              </Button>
            }
          >
            {upcoming.isPending ? (
              <Skeleton className="h-24" />
            ) : (
              <AgendaList items={upcoming.data ?? []} from={today} to={weekEnd} onOpenItem={openItem} />
            )}
          </SectionCard>
        </div>
      </div>
      <EventModal
        open={eventOpen}
        onOpenChange={setEventOpen}
        event={event}
        defaults={{ projectKey: project.key }}
        appointment={addingAppointment}
        lockTarget
      />
    </div>
  );
}
