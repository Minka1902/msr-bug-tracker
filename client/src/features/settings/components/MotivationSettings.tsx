import { toast } from 'sonner';
import type { Motivation } from '@msr/shared/schemas/planner';
import { Field } from '../../../components/ui/Field';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useUpdateMe } from '../../auth/api';

const PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed', title: 'About one task a week' },
  { value: 'steady', label: 'Steady', title: 'A task every few days' },
  { value: 'intense', label: 'Intense', title: 'A task every day' },
] as const;

const SIZE_OPTIONS = [
  { value: 'tiny', label: '15 min' },
  { value: 'small', label: '1 hour' },
  { value: 'medium', label: 'Half a day' },
] as const;

const SHARE_OPTIONS = [
  { value: 'max', label: 'AI first', title: 'You only get what the AI can’t do' },
  { value: 'balanced', label: 'Balanced', title: 'You keep the creative and decision work' },
  { value: 'human', label: 'Mostly me', title: 'The AI only researches and drafts' },
] as const;

const HINTS = {
  pace: { relaxed: 'About one task a week.', steady: 'A task every few days.', intense: 'A task every day.' },
  aiShare: {
    max: 'A task goes to you only when the AI can’t do it without a person.',
    balanced: 'You keep the creative and decision-making work.',
    human: 'The AI only researches, drafts and summarizes.',
  },
};

export function MotivationSettings() {
  const change = (patch: Partial<Motivation>) =>
    updateMe.mutate(
      { preferences: { motivation: { ...motivation, ...patch } } },
      { onError: (error) => toast.error(errorMessage(error)) },
    );

  const { preferences } = useCurrentUser();
  const updateMe = useUpdateMe();
  const motivation = preferences.motivation;

  return (
    <div className="flex flex-col gap-4">
      <Field label="How often you get a deadline" hint={HINTS.pace[motivation.pace]}>
        <SegmentedControl
          label="How often you get a deadline"
          options={[...PACE_OPTIONS]}
          value={motivation.pace}
          onChange={(pace) => change({ pace })}
          block
        />
      </Field>
      <Field label="How big each task is">
        <SegmentedControl
          label="How big each task is"
          options={[...SIZE_OPTIONS]}
          value={motivation.taskSize}
          onChange={(taskSize) => change({ taskSize })}
          block
        />
      </Field>
      <Field label="Who does the work" hint={HINTS.aiShare[motivation.aiShare]}>
        <SegmentedControl
          label="Who does the work"
          options={[...SHARE_OPTIONS]}
          value={motivation.aiShare}
          onChange={(aiShare) => change({ aiShare })}
          block
        />
      </Field>
    </div>
  );
}
