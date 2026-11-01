import { createContext } from 'react';
import type { TextPromptOptions } from '../components/ui/TextPromptDialog';

export type PromptFn = (options: TextPromptOptions) => Promise<string | null>;

export const PromptContext = createContext<PromptFn | null>(null);
