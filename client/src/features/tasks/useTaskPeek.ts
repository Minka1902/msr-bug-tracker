import { useSearchParams } from 'react-router';

const PARAM = 'task';

export const useTaskPeek = () => {
  const open = (identifier: string, { replace = false } = {}) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(PARAM, identifier.toUpperCase());
        return next;
      },
      { replace },
    );

  const close = () =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete(PARAM);
      return next;
    });

  const [params, setParams] = useSearchParams();

  return { identifier: params.get(PARAM), open, close };
};
