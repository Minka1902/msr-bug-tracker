import { useContext } from 'react';
import { ShellContext } from '../context/shellContext';

export const useShell = () => {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside AppLayout');
  return value;
};
