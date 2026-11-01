import { useContext } from 'react';
import { PromptContext } from '../context/promptContext';

export const usePrompt = () => {
  const prompt = useContext(PromptContext);
  if (!prompt) throw new Error('usePrompt must be used inside PromptProvider');
  return prompt;
};
