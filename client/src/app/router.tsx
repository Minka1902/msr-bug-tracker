import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteError } from '../pages/RouteError';
import { lazyRoute } from '../lib/lazy';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { GuestOnly } from './GuestOnly';
import { RequireAuth } from './RequireAuth';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: lazyRoute(() => import('../pages/dev/UiPreviewPage').then((m) => m.UiPreviewPage)),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullScreenLoader />,
    children: [
      ...devRoutes,
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        path: '/install',
        lazy: lazyRoute(() => import('../features/pwa/InstallPage').then((m) => m.InstallPage)),
      },
      {
        path: '/connect/authorize',
        lazy: lazyRoute(() =>
          import('../features/connector/pages/ConnectorConsentPage').then((m) => m.ConnectorConsentPage),
        ),
      },
      {
        path: '/invite/:token',
        lazy: lazyRoute(() => import('../features/invites/pages/InvitePage').then((m) => m.InvitePage)),
      },
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
          {
            path: '/',
            lazy: lazyRoute(() =>
              import('../features/insights/pages/DashboardPage').then((m) => m.DashboardPage),
            ),
          },
          {
            path: '/my-tasks',
            lazy: lazyRoute(() =>
              import('../features/insights/pages/MyTasksPage').then((m) => m.MyTasksPage),
            ),
          },
          {
            path: '/projects',
            lazy: lazyRoute(() =>
              import('../features/projects/pages/ProjectsPage').then((m) => m.ProjectsPage),
            ),
          },
          {
            path: '/calendar',
            lazy: lazyRoute(() =>
              import('../features/calendar/pages/CalendarPage').then((m) => m.CalendarPage),
            ),
          },
          {
            path: '/shop',
            lazy: lazyRoute(() => import('../features/shop/pages/ShopPage').then((m) => m.ShopPage)),
          },
          {
            path: '/t/:identifier',
            lazy: lazyRoute(() =>
              import('../features/tasks/pages/IdentifierRedirect').then((m) => m.IdentifierRedirect),
            ),
          },
          {
            path: '/p/:key',
            lazy: lazyRoute(() =>
              import('../features/projects/pages/ProjectLayout').then((m) => m.ProjectLayout),
            ),
            children: [
              {
                index: true,
                lazy: lazyRoute(() =>
                  import('../features/projects/pages/ProjectIndexRedirect').then(
                    (m) => m.ProjectIndexRedirect,
                  ),
                ),
              },
              {
                path: 'home',
                lazy: lazyRoute(() =>
                  import('../features/household/pages/HouseholdHomePage').then((m) => m.HouseholdHomePage),
                ),
              },
              {
                path: 'shopping',
                lazy: lazyRoute(() =>
                  import('../features/household/pages/ShoppingPage').then((m) => m.ShoppingPage),
                ),
              },
              {
                path: 'calendar',
                lazy: lazyRoute(() =>
                  import('../features/household/pages/HouseholdCalendarPage').then(
                    (m) => m.HouseholdCalendarPage,
                  ),
                ),
              },
              {
                path: 'overview',
                lazy: lazyRoute(() =>
                  import('../features/insights/pages/ProjectOverviewPage').then((m) => m.ProjectOverviewPage),
                ),
              },
              {
                path: 'board',
                lazy: lazyRoute(() => import('../features/tasks/pages/BoardPage').then((m) => m.BoardPage)),
              },
              {
                path: 'activity',
                lazy: lazyRoute(() =>
                  import('../features/insights/pages/ProjectActivityPage').then((m) => m.ProjectActivityPage),
                ),
              },
              {
                path: 'list',
                lazy: lazyRoute(() => import('../features/tasks/pages/ListPage').then((m) => m.ListPage)),
              },
              {
                path: 'bugs',
                lazy: lazyRoute(() => import('../features/tasks/pages/BugsPage').then((m) => m.BugsPage)),
              },
              {
                path: ':number',
                lazy: lazyRoute(() => import('../features/tasks/pages/TaskPage').then((m) => m.TaskPage)),
              },
              {
                path: 'settings',
                lazy: lazyRoute(() =>
                  import('../features/projects/settings/ProjectSettingsLayout').then(
                    (m) => m.ProjectSettingsLayout,
                  ),
                ),
                children: [
                  { index: true, element: <Navigate to="general" replace /> },
                  {
                    path: 'general',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/GeneralSettings').then((m) => m.GeneralSettings),
                    ),
                  },
                  {
                    path: 'workflows',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/WorkflowSettings').then(
                        (m) => m.WorkflowSettings,
                      ),
                    ),
                  },
                  {
                    path: 'labels',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/LabelSettings').then((m) => m.LabelSettings),
                    ),
                  },
                  {
                    path: 'members',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/MemberSettings').then((m) => m.MemberSettings),
                    ),
                  },
                  {
                    path: 'roles',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/RoleSettings').then((m) => m.RoleSettings),
                    ),
                  },
                  {
                    path: 'telegram',
                    lazy: lazyRoute(() =>
                      import('../features/telegram/pages/TelegramSettings').then((m) => m.TelegramSettings),
                    ),
                  },
                  {
                    path: 'danger',
                    lazy: lazyRoute(() =>
                      import('../features/projects/settings/DangerSettings').then((m) => m.DangerSettings),
                    ),
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: '/settings',
            lazy: lazyRoute(() =>
              import('../features/settings/pages/SettingsPage').then((m) => m.SettingsPage),
            ),
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              {
                path: 'profile',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/ProfileSettings').then((m) => m.ProfileSettings),
                ),
              },
              {
                path: 'account',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/AccountSettings').then((m) => m.AccountSettings),
                ),
              },
              {
                path: 'security',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/SecuritySettings').then((m) => m.SecuritySettings),
                ),
              },
              {
                path: 'ai',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/AiSettings').then((m) => m.AiSettings),
                ),
              },
              {
                path: 'connected-apps',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/ConnectedAppsSettings').then(
                    (m) => m.ConnectedAppsSettings,
                  ),
                ),
              },
              {
                path: 'calendars',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/CalendarSettings').then((m) => m.CalendarSettings),
                ),
              },
              {
                path: 'appearance',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/AppearanceSettings').then((m) => m.AppearanceSettings),
                ),
              },
              {
                path: 'demo',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/DemoDataSettings').then((m) => m.DemoDataSettings),
                ),
              },
              {
                path: 'install',
                lazy: lazyRoute(() =>
                  import('../features/settings/pages/InstallSettings').then((m) => m.InstallSettings),
                ),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
