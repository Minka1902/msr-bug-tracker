import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';

export type CalendarMode = 'month' | 'week' | 'agenda';

interface CalendarToolbarProps {
  title: string;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent?: () => void;
  children?: ReactNode;
}

export function CalendarToolbar({
  title,
  mode,
  onModeChange,
  onPrevious,
  onNext,
  onToday,
  onNewEvent,
  children,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton icon={<ChevronLeft />} label="Previous" onClick={onPrevious} />
        <IconButton icon={<ChevronRight />} label="Next" onClick={onNext} />
        <Button size="sm" variant="secondary" onClick={onToday}>
          Today
        </Button>
      </div>
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
      {children}
      <SegmentedControl
        size="sm"
        label="Calendar view"
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'month', label: 'Month', icon: <CalendarDays /> },
          { value: 'week', label: 'Week', icon: <CalendarRange /> },
          { value: 'agenda', label: 'Agenda', icon: <List /> },
        ]}
      />
      {onNewEvent && (
        <Button size="sm" leftIcon={<Plus />} onClick={onNewEvent}>
          New event
        </Button>
      )}
    </div>
  );
}
