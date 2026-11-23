import { ListChecks } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import type { TaskSelection } from '../hooks/useTaskSelection';

interface SelectToggleProps {
  selection: TaskSelection;
  label: string;
  className?: string;
}

export function SelectToggle({ selection, label, className }: SelectToggleProps) {
  return (
    <Button
      size="sm"
      variant={selection.selecting ? 'soft' : 'secondary'}
      leftIcon={<ListChecks />}
      aria-label={label}
      aria-pressed={selection.selecting}
      onClick={selection.selecting ? selection.clear : selection.start}
      className={cn(className)}
    >
      Select
    </Button>
  );
}
