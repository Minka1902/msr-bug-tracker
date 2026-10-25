import { useState } from 'react';
import { readLocal, writeLocal } from '../lib/localStore';

export const useLocalState = <T>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => readLocal(key, { value: initial }).value);

  const update = (next: T) => {
    setValue(next);
    writeLocal(key, { value: next });
  };

  return [value, update] as const;
};
