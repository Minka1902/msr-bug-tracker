import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { RegisterPage } from '../pages/RegisterPage';

const resend = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../api', () => ({
  useRegister: () => ({
    isPending: false,
    error: null,
    mutate: (_: unknown, options: { onSuccess: (value: { verificationSent: boolean }) => void }) =>
      options.onSuccess({ verificationSent: false }),
  }),
}));
vi.mock('../useSendVerificationLink', () => ({ useSendVerificationLink: () => ({ mutate: resend }) }));

describe('RegisterPage', () => {
  it('asks to verify the email without mentioning a failure when the link could not be sent', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dana@msr.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    const [message, options] = vi.mocked(toast.info).mock.calls[0]!;
    expect(String(message)).not.toMatch(/resend|couldn't/i);
    expect(toast.warning).not.toHaveBeenCalled();

    const action = (options as { action: { label: string; onClick: () => void } }).action;
    expect(action.label).toBe('Send link');
    action.onClick();
    expect(resend).toHaveBeenCalledTimes(1);
  });
});
