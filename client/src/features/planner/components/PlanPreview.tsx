import { CalendarDays, ListChecks } from 'lucide-react';
import { DOERS, type Doer, type PlanTask } from '@msr/shared/schemas/planner';
import { Checkbox } from '../../../components/ui/Checkbox';
import { formatDue } from '../../../lib/dates';
import { cn } from '../../../lib/cn';
import { DoerBadge } from './DoerBadge';

interface PlanPreviewProps {
  tasks: PlanTask[];
  selected: boolean[];
  onToggle: (index: number) => void;
  className?: string;
}

const GROUP_TITLES: Record<Doer, string> = {
  human: 'For you',
  ai: 'For the AI worker',
  skill: 'Skills to run',
};

export function PlanPreview({ tasks, selected, onToggle, className }: PlanPreviewProps) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {DOERS.filter((doer) => tasks.some((task) => task.doer === doer)).map((doer) => (
        <section key={doer} aria-label={GROUP_TITLES[doer]} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <DoerBadge doer={doer} />
            {GROUP_TITLES[doer]}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task, index) =>
              task.doer === doer ? (
                <li
                  key={`${index}-${task.title}`}
                  className={cn(
                    'flex items-start gap-3 rounded-control border border-border bg-surface p-3',
                    !selected[index] && 'opacity-60',
                  )}
                >
                  <Checkbox
                    checked={selected[index] ?? false}
                    onCheckedChange={() => onToggle(index)}
                    aria-label={`Keep ${task.title}`}
                    className="mt-0.5"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.summary && <p className="text-xs text-muted">{task.summary}</p>}
                    <p className="flex flex-wrap items-center gap-3 text-xs text-subtle">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3.5" aria-hidden />
                          {formatDue(task.dueDate)}
                        </span>
                      )}
                      {task.steps.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ListChecks className="size-3.5" aria-hidden />
                          {task.steps.length} steps
                        </span>
                      )}
                      {task.skill && <code className="font-mono">{task.skill}</code>}
                    </p>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
