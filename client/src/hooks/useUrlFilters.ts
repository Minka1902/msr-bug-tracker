import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const FILTER_KEYS = [
  'q',
  'status',
  'category',
  'type',
  'priority',
  'severity',
  'assignee',
  'label',
  'project',
  'dueFrom',
  'dueTo',
  'createdFrom',
  'createdTo',
  'overdue',
  'blocked',
  'hideDone',
  'topLevel',
  'sort',
  'dir',
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterValues = Partial<Record<FilterKey, string>>;

const CONTROL_KEYS = new Set<FilterKey>(['sort', 'dir', 'q']);

const NO_DEFAULTS: FilterValues = {};

export const useUrlFilters = (defaults: FilterValues = NO_DEFAULTS) => {
  const update = (patch: Partial<Record<FilterKey, string | string[] | null>>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          const text = Array.isArray(value) ? value.join(',') : value;
          if (text) next.set(key, text);
          else if (key in defaults) next.set(key, 'false');
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const clear = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        FILTER_KEYS.filter((key) => !CONTROL_KEYS.has(key) || key === 'q').forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );

  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const values: FilterValues = { ...defaults };
    for (const key of FILTER_KEYS) {
      const value = params.get(key);
      if (value) values[key] = value;
    }
    return values;
  }, [params, defaults]);
  const activeCount = FILTER_KEYS.filter((key) => !CONTROL_KEYS.has(key) && params.get(key)).length;

  return { filters, update, clear, activeCount };
};

export const listValue = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : []);
