import { useMe } from '../features/auth/api';

export const useCurrentUser = () => {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser must be used inside an authenticated route');
  return data;
};
