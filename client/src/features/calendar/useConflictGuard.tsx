import { useConfirm } from '../../hooks/useConfirm';
import { fetchConflicts, type ConflictTarget } from './api';
import { ConflictList } from './components/ConflictList';

export const useConflictGuard = () => {
  const confirm = useConfirm();
  return async (target: ConflictTarget) => {
    const conflicts = await fetchConflicts(target).catch(() => []);
    if (!conflicts.length) return true;
    return confirm({
      title:
        conflicts.length === 1
          ? 'This clashes with a very important event'
          : `This clashes with ${conflicts.length} very important events`,
      description: <ConflictList conflicts={conflicts} />,
      confirmLabel: 'Save anyway',
      cancelLabel: 'Change it',
      tone: 'primary',
    });
  };
};
