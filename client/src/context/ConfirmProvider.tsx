import { useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ui/ConfirmDialog';
import { ConfirmContext } from './confirmContext';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const confirm = (next: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(next);
    });

  const handleResolve = (confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  };

  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  return (
    <ConfirmContext value={confirm}>
      {children}
      {options && <ConfirmDialog open onResolve={handleResolve} {...options} />}
    </ConfirmContext>
  );
}
