import { createBrowserRouter, type RouteObject } from 'react-router';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '/dev/ui', lazy: async () => ({ Component: (await import('../pages/dev/UiPreviewPage')).UiPreviewPage }) }]
  : [];

export const router = createBrowserRouter([...devRoutes]);
