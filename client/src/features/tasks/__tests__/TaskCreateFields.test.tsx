import { fireEvent, render, screen } from '@testing-library/react';
import type { ProjectDetail } from '@msr/shared/types';
import { describe, expect, it, vi } from 'vitest';
import { TaskCreateFields, taskCreateValues } from '../components/TaskCreateFields';

vi.mock('../../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ id: 'me', name: 'Me' }) }));

const project = (module: ProjectDetail['module']) =>
  ({
    module,
    statuses: [],
    labels: [],
    memberList: [],
    permissions: 0,
    cardTypes: [],
    isOwner: true,
  }) as unknown as ProjectDetail;

const switchNamed = () => screen.queryByRole('switch', { name: 'Carry over until done' });

describe('TaskCreateFields carry over', () => {
  it('appears for household tasks with a due date, on for chores and off for errands', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TaskCreateFields
        project={project('household')}
        values={taskCreateValues('chore', { dueDate: '2030-05-10' })}
        onChange={onChange}
      />,
    );
    expect(switchNamed()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(switchNamed()!);
    expect(onChange).toHaveBeenCalledWith({ carryOver: false });

    rerender(
      <TaskCreateFields
        project={project('household')}
        values={taskCreateValues('errand', { dueDate: '2030-05-10' })}
        onChange={onChange}
      />,
    );
    expect(switchNamed()).toHaveAttribute('aria-checked', 'false');
  });

  it('stays hidden without a due date or outside households', () => {
    const { rerender } = render(
      <TaskCreateFields
        project={project('household')}
        values={taskCreateValues('chore')}
        onChange={vi.fn()}
      />,
    );
    expect(switchNamed()).toBeNull();
    rerender(
      <TaskCreateFields
        project={project('software')}
        values={taskCreateValues('task', { dueDate: '2030-05-10' })}
        onChange={vi.fn()}
      />,
    );
    expect(switchNamed()).toBeNull();
  });
});
