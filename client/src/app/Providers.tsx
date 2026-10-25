import { QueryClientProvider } from '@tanstack/react-query';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '../context/ConfirmProvider';
import { ThemeProvider } from '../context/ThemeProvider';
import { UpdatePrompt } from '../features/pwa/UpdatePrompt';
import { queryClient } from './queryClient';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Tooltip.Provider delayDuration={300}>
          <ConfirmProvider>
            {children}
            <Toaster position="bottom-right" closeButton toastOptions={{ className: 'font-sans' }} />
            <UpdatePrompt />
          </ConfirmProvider>
        </Tooltip.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
