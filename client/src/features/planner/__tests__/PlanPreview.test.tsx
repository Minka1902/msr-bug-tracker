import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanPreview } from '../components/PlanPreview';

const DRAFT = {
  tasks: [
    {
      title: 'Interview 5 people',
      doer: 'human' as const,
      summary: '',
      steps: [],
      skill: null,
      prompt: null,
      dueDate: null,
    },
  ],
  features: [
    { title: 'Gaze detection', summary: 'Know which screen you look at.', phase: 'mvp' as const },
    { title: 'Team licences', summary: '', phase: 'later' as const },
  ],
  decisions: [
    { title: 'Which camera first?', context: 'Hardware drives cost.', options: ['Webcam', 'Tobii'] },
  ],
};

describe('PlanPreview', () => {
  it('shows features and decisions next to the steps, each one removable', () => {
    const onToggle = vi.fn();
    render(
      <PlanPreview
        draft={DRAFT}
        selected={{ tasks: [true], features: [true, false], decisions: [true] }}
        onToggle={onToggle}
      />,
    );
    const features = screen.getByRole('region', { name: 'Features' });
    expect(within(features).getByText('MVP')).toBeInTheDocument();
    expect(within(features).getByText('Later')).toBeInTheDocument();
    const decisions = screen.getByRole('region', { name: 'Decisions for you' });
    expect(within(decisions).getByText('Webcam · Tobii')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Keep Team licences' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep Gaze detection' }));
    expect(onToggle).toHaveBeenCalledWith('features', 0);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep Which camera first?' }));
    expect(onToggle).toHaveBeenCalledWith('decisions', 0);
  });
});
