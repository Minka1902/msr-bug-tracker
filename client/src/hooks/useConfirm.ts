import { useContext } from 'react';
import { ConfirmContext } from '../context/confirmContext';

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
};
