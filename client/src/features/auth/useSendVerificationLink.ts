import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';

export const useSendVerificationLink = () =>
  useMutation({
    mutationFn: (email: string) => api('/auth/resend-verification', { method: 'POST' }).then(() => email),
    onSuccess: (email) => toast.success(`Verification email sent to ${email}`),
    onError: (error) => toast.error(errorMessage(error)),
  });
