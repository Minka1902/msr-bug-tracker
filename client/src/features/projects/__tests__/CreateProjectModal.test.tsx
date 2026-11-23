import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProjectModal } from '../components/CreateProjectModal';

const PROJECT = { key: 'EYE', name: 'Eye tracker', module: 'startup', description: '' };
const mutation = (overrides: Record<string, unknown> = {}) => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null,
  ...overrides,
});
const state = vi.hoisted(() => ({
  keys: [] as { provider: string }[],
  askError: null as Error | null,
  create: null as unknown as ReturnType<typeof vi.fn>,
  handoff: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api', () => ({
  useCreateProject: () => ({
    ...mutation(),
    mutate: state.create,
  }),
  useKeyAvailability: () => ({ data: { key: 'EYE', available: true }, isFetching: false }),
}));
vi.mock('../../planner/api', () => ({
  useAskQuestions: () => mutation({ error: state.askError }),
  useDraftPlan: () => mutation(),
  useCommitPlan: () => mutation(),
  useHandoffPlan: () => ({ ...mutation(), mutate: state.handoff }),
}));
vi.mock('../../settings/aiKeysApi', () => ({ useAiKeys: () => ({ data: state.keys }) }));
vi.mock('../../agents/api', () => ({
  useWorkers: () => ({ data: [{ id: 'worker-1', name: 'Claude worker', connection: { id: 'c', name: 'Claude' } }] }),
}));
vi.mock('../../shop/api', () => ({ useShop: () => ({ data: undefined }), useRefreshShop: () => vi.fn() }));

const renderModal = () =>
  render(
    <MemoryRouter>
      <CreateProjectModal open onOpenChange={vi.fn()} initialModule="startup" />
    </MemoryRouter>,
  );

describe('CreateProjectModal planning', () => {
  beforeEach(() => {
    state.keys = [];
    state.askError = null;
    state.create = vi.fn((_values, options: { onSuccess: (project: typeof PROJECT) => void }) =>
      options.onSuccess(PROJECT),
    );
    state.handoff = vi.fn();
  });

  it('plans a startup by default and hands it to the AI worker when there is no AI key', async () => {
    renderModal();
    expect(screen.getByRole('checkbox', { name: 'Plan it for me: steps, features and decisions' })).toBeChecked();
    expect(screen.getByText(/Claude worker plans it/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Eye tracker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & plan' }));
    await waitFor(() => expect(state.create).toHaveBeenCalled());
    expect(state.handoff).toHaveBeenCalledWith(
      { projectKey: 'EYE', agentId: 'worker-1', answers: [] },
      expect.anything(),
    );
  });

  it('offers the AI worker when the AI key fails', async () => {
    state.keys = [{ provider: 'anthropic' }];
    state.askError = new Error('Claude answered: Your credit balance is too low.');
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Eye tracker' } });
    expect(screen.getByText(/credit balance is too low/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Let my AI worker plan it' }));
    await waitFor(() => expect(state.handoff).toHaveBeenCalled());
    expect(state.handoff.mock.calls[0]![0]).toMatchObject({ projectKey: 'EYE', agentId: 'worker-1' });
  });
});
