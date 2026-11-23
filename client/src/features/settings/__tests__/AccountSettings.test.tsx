import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { AccountSettings } from '../pages/AccountSettings';

const resend = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ email: 'old@msr.local', emailVerified: true }),
}));
vi.mock('../../auth/api', () => ({
  useChangeEmail: () => ({
    isPending: false,
    mutate: (_: unknown, options: { onSuccess: (value: { verificationSent: boolean }) => void }) =>
      options.onSuccess({ verificationSent: false }),
  }),
  useChangePassword: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('../../auth/useSendVerificationLink', () => ({
  useSendVerificationLink: () => ({ mutate: resend }),
}));

describe('AccountSettings', () => {
  it('asks to verify the new email without mentioning a failure when the link could not be sent', async () => {
    render(<AccountSettings />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@msr.local' } });
    fireEvent.change(screen.getAllByLabelText('Current password')[0]!, {
      target: { value: 'secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    const [message, options] = vi.mocked(toast.info).mock.calls[0]!;
    expect(String(message)).not.toMatch(/resend|couldn't/i);
    expect(String(message)).toContain('new@msr.local');
    expect(toast.warning).not.toHaveBeenCalled();

    const action = (options as { action: { label: string; onClick: () => void } }).action;
    expect(action.label).toBe('Send link');
    action.onClick();
    expect(resend).toHaveBeenCalledTimes(1);
  });
});
