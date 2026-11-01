import { useRef, useState, type ReactNode } from 'react';
import { TextPromptDialog, type TextPromptOptions } from '../components/ui/TextPromptDialog';
import { PromptContext } from './promptContext';

export function PromptProvider({ children }: { children: ReactNode }) {
  const prompt = (next: TextPromptOptions) =>
    new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setOptions(next);
    });

  const handleResolve = (value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  };

  const [options, setOptions] = useState<TextPromptOptions | null>(null);
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  return (
    <PromptContext value={prompt}>
      {children}
      {options && (
        <TextPromptDialog
          open
          onOpenChange={(open) => !open && handleResolve(null)}
          onSubmit={handleResolve}
          {...options}
        />
      )}
    </PromptContext>
  );
}
