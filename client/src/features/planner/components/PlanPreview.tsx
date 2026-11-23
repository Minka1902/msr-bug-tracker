import { CalendarDays, Layers, ListChecks, MessagesSquare } from 'lucide-react';
import { DOERS, type Doer, type PlanDraft } from '@msr/shared/schemas/planner';
import { Badge } from '../../../components/ui/Badge';
import { formatDue } from '../../../lib/dates';
import { cn } from '../../../lib/cn';
import { DoerBadge } from './DoerBadge';
import { PlanItemRow } from './PlanItemRow';
import { PlanSection } from './PlanSection';

export type PlanSelection = Record<keyof PlanDraft, boolean[]>;

interface PlanPreviewProps {
  draft: PlanDraft;
  selected: PlanSelection;
  onToggle: (group: keyof PlanDraft, index: number) => void;
  className?: string;
}

const GROUP_TITLES: Record<Doer, string> = {
  human: 'For you',
  ai: 'For the AI worker',
  skill: 'Skills to run',
};
const PHASE_LABELS = { mvp: 'MVP', later: 'Later' } as const;

export function PlanPreview({ draft, selected, onToggle, className }: PlanPreviewProps) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {DOERS.filter((doer) => draft.tasks.some((task) => task.doer === doer)).map((doer) => (
        <PlanSection key={doer} title={GROUP_TITLES[doer]} icon={<DoerBadge doer={doer} />}>
          {draft.tasks.map((task, index) =>
            task.doer === doer ? (
              <PlanItemRow
                key={`${index}-${task.title}`}
                title={task.title}
                summary={task.summary}
                kept={selected.tasks[index] ?? false}
                onToggle={() => onToggle('tasks', index)}
                meta={
                  (task.dueDate || task.steps.length > 0 || task.skill) && (
                    <>
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
                    </>
                  )
                }
              />
            ) : null,
          )}
        </PlanSection>
      ))}
      {draft.features.length > 0 && (
        <PlanSection title="Features" icon={<Layers className="size-4 text-accent-text" />}>
          {draft.features.map((feature, index) => (
            <PlanItemRow
              key={`${index}-${feature.title}`}
              title={feature.title}
              summary={feature.summary}
              kept={selected.features[index] ?? false}
              onToggle={() => onToggle('features', index)}
              meta={<Badge size="xs" label={PHASE_LABELS[feature.phase]} />}
            />
          ))}
        </PlanSection>
      )}
      {draft.decisions.length > 0 && (
        <PlanSection title="Decisions for you" icon={<MessagesSquare className="size-4 text-accent-text" />}>
          {draft.decisions.map((decision, index) => (
            <PlanItemRow
              key={`${index}-${decision.title}`}
              title={decision.title}
              summary={decision.context}
              kept={selected.decisions[index] ?? false}
              onToggle={() => onToggle('decisions', index)}
              meta={decision.options.length > 0 && <span>{decision.options.join(' · ')}</span>}
            />
          ))}
        </PlanSection>
      )}
    </div>
  );
}
