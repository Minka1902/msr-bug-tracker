import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useState } from 'react';
import type { CalendarItem } from '@msr/shared/types';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useLocalState } from '../../../hooks/useLocalState';
import { cn } from '../../../lib/cn';
import { PHONE } from '../../../lib/media';
import { useTaskPeek } from '../../tasks/useTaskPeek';
import { useCalendarItems } from '../api';
import { dayKey, weekStartsOn, type WeekStart } from '../calendarDates';
import { AgendaList } from './AgendaList';
import { CalendarToolbar, type CalendarMode } from './CalendarToolbar';
import { EventModal, type EventDefaults } from './EventModal';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';

interface CalendarViewProps {
  projectKey?: string;
  lockTarget?: boolean;
  storageKey?: string;
  agendaDays?: number;
  className?: string;
}

interface Editor {
  event: CalendarItem | null;
  defaults: EventDefaults;
}

const rangeOf = (mode: CalendarMode, anchor: Date, weekStart: WeekStart, agendaDays: number) => {
  if (mode === 'month')
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: weekStart }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: weekStart }),
    };
  if (mode === 'week')
    return {
      start: startOfWeek(anchor, { weekStartsOn: weekStart }),
      end: endOfWeek(anchor, { weekStartsOn: weekStart }),
    };
  return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), agendaDays - 1) };
};

const titleOf = (mode: CalendarMode, anchor: Date, range: { start: Date; end: Date }) => {
  if (mode === 'month') return format(anchor, 'MMMM yyyy');
  const sameYear = range.start.getFullYear() === range.end.getFullYear();
  return `${format(range.start, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(range.end, 'MMM d, yyyy')}`;
};

export function CalendarView({
  projectKey,
  lockTarget,
  storageKey = 'msr-calendar-mode',
  agendaDays = 42,
  className,
}: CalendarViewProps) {
  const step = (direction: 1 | -1) =>
    setAnchor((current) =>
      mode === 'month'
        ? addMonths(current, direction)
        : mode === 'week'
          ? addWeeks(current, direction)
          : addDays(current, direction * agendaDays),
    );

  const openItem = (item: CalendarItem) => {
    if (item.kind === 'task' && item.taskIdentifier) peek.open(item.taskIdentifier);
    else openEditor({ event: item, defaults: {} });
  };

  const openEditor = (next: Editor) => {
    setEditor(next);
    setEditorOpen(true);
  };

  const create = (date?: string, time?: string) =>
    openEditor({ event: null, defaults: { date, time, projectKey } });

  const peek = useTaskPeek();
  const weekStart = weekStartsOn();
  const [mode, setMode] = useLocalState<CalendarMode>(
    storageKey,
    window.matchMedia(PHONE).matches ? 'agenda' : 'month',
  );
  const [anchor, setAnchor] = useState(() => new Date());
  const [editor, setEditor] = useState<Editor>({ event: null, defaults: {} });
  const [editorOpen, setEditorOpen] = useState(false);
  const range = rangeOf(mode, anchor, weekStart, agendaDays);
  const from = dayKey(range.start);
  const to = dayKey(range.end);
  const items = useCalendarItems(from, to, projectKey);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <CalendarToolbar
        title={titleOf(mode, anchor, range)}
        mode={mode}
        onModeChange={setMode}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchor(new Date())}
        onNewEvent={() => create()}
      />
      {items.error && <ErrorState error={items.error} onRetry={items.refetch} />}
      {items.isPending && <Skeleton className="h-[32rem] rounded-card" />}
      {items.data && mode === 'month' && (
        <MonthGrid
          anchor={anchor}
          items={items.data}
          weekStartsOn={weekStart}
          onOpenItem={openItem}
          onCreate={create}
          onShowDay={(day) => {
            setAnchor(day);
            setMode('week');
          }}
        />
      )}
      {items.data && mode === 'week' && (
        <WeekGrid
          anchor={anchor}
          items={items.data}
          weekStartsOn={weekStart}
          onOpenItem={openItem}
          onCreate={create}
        />
      )}
      {items.data && mode === 'agenda' && (
        <AgendaList items={items.data} from={from} to={to} onOpenItem={openItem} />
      )}
      <EventModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={editor.event}
        defaults={editor.defaults}
        lockTarget={lockTarget}
      />
    </div>
  );
}
