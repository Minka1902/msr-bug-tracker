import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('shows the offline variant for network errors and retries when back online', () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(0, 'offline')} onRetry={onRetry} />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    act(() => {
      dispatchEvent(new Event('online'));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the error message for other errors and does not auto-retry', () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(500, 'Boom')} onRetry={onRetry} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    act(() => {
      dispatchEvent(new Event('online'));
    });
    expect(onRetry).not.toHaveBeenCalled();
  });
});
