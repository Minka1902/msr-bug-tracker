import { lazy, type ComponentType } from 'react';

export const lazyRoute = (load: () => Promise<ComponentType>) => async () => ({ Component: await load() });

export const lazyComponent = <P extends object>(load: () => Promise<ComponentType<P>>) =>
  lazy(async () => ({ default: await load() }));
