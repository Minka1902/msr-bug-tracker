import type { PlanQuestion } from '@msr/shared/schemas/planner';
import { Textarea } from '../../../components/ui/Textarea';
import { cn } from '../../../lib/cn';

interface IdeaQuestionsProps {
  questions: PlanQuestion[];
  answers: string[];
  onChange: (index: number, answer: string) => void;
  className?: string;
}

export function IdeaQuestions({ questions, answers, onChange, className }: IdeaQuestionsProps) {
  return (
    <ol className={cn('flex flex-col gap-5', className)}>
      {questions.map((item, index) => (
        <li key={item.question} className="flex flex-col gap-2">
          <label htmlFor={`idea-answer-${index}`} className="text-sm font-medium">
            {index + 1}. {item.question}
          </label>
          {item.choices.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={`Suggested answers to question ${index + 1}`}
            >
              {item.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={answers[index] === choice}
                  onClick={() => onChange(index, answers[index] === choice ? '' : choice)}
                  className="tap-target cursor-pointer rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-border-strong aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-text"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
          <Textarea
            id={`idea-answer-${index}`}
            rows={2}
            maxLength={1000}
            value={answers[index] ?? ''}
            placeholder={item.choices.length ? 'Or write your own answer' : 'Your answer'}
            onChange={(event) => onChange(index, event.target.value)}
          />
        </li>
      ))}
    </ol>
  );
}
