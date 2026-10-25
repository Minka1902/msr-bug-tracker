import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { AccountSettings } from '../features/settings/pages/AccountSettings';
import { AppearanceSettings } from '../features/settings/pages/AppearanceSettings';
import { ProfileSettings } from '../features/settings/pages/ProfileSettings';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteError } from '../pages/RouteError';
import { GuestOnly } from './GuestOnly';
import { RequireAuth } from './RequireAuth';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: async () => ({ Component: (await import('../pages/dev/UiPreviewPage')).UiPreviewPage }),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      ...devRoutes,
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <Navigate to="/settings" replace /> },
          {
            path: '/settings',
            element: <SettingsPage />,
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              { path: 'profile', element: <ProfileSettings /> },
              { path: 'account', element: <AccountSettings /> },
              { path: 'appearance', element: <AppearanceSettings /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
