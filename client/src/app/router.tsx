import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { ProjectLayout } from '../features/projects/pages/ProjectLayout';
import { ProjectsPage } from '../features/projects/pages/ProjectsPage';
import { DangerSettings } from '../features/projects/settings/DangerSettings';
import { GeneralSettings } from '../features/projects/settings/GeneralSettings';
import { LabelSettings } from '../features/projects/settings/LabelSettings';
import { MemberSettings } from '../features/projects/settings/MemberSettings';
import { ProjectSettingsLayout } from '../features/projects/settings/ProjectSettingsLayout';
import { RoleSettings } from '../features/projects/settings/RoleSettings';
import { WorkflowSettings } from '../features/projects/settings/WorkflowSettings';
import { AccountSettings } from '../features/settings/pages/AccountSettings';
import { DashboardPage } from '../features/insights/pages/DashboardPage';
import { MyTasksPage } from '../features/insights/pages/MyTasksPage';
import { ProjectActivityPage } from '../features/insights/pages/ProjectActivityPage';
import { ProjectOverviewPage } from '../features/insights/pages/ProjectOverviewPage';
import { BoardPage } from '../features/tasks/pages/BoardPage';
import { BugsPage } from '../features/tasks/pages/BugsPage';
import { IdentifierRedirect } from '../features/tasks/pages/IdentifierRedirect';
import { ListPage } from '../features/tasks/pages/ListPage';
import { TaskPage } from '../features/tasks/pages/TaskPage';
import { AppearanceSettings } from '../features/settings/pages/AppearanceSettings';
import { DemoDataSettings } from '../features/settings/pages/DemoDataSettings';
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
          { path: '/', element: <DashboardPage /> },
          { path: '/my-tasks', element: <MyTasksPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/t/:identifier', element: <IdentifierRedirect /> },
          {
            path: '/p/:key',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <Navigate to="board" replace /> },
              { path: 'overview', element: <ProjectOverviewPage /> },
              { path: 'board', element: <BoardPage /> },
              { path: 'activity', element: <ProjectActivityPage /> },
              { path: 'list', element: <ListPage /> },
              { path: 'bugs', element: <BugsPage /> },
              { path: ':number', element: <TaskPage /> },
              {
                path: 'settings',
                element: <ProjectSettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="general" replace /> },
                  { path: 'general', element: <GeneralSettings /> },
                  { path: 'workflows', element: <WorkflowSettings /> },
                  { path: 'labels', element: <LabelSettings /> },
                  { path: 'members', element: <MemberSettings /> },
                  { path: 'roles', element: <RoleSettings /> },
                  { path: 'danger', element: <DangerSettings /> },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: '/settings',
            element: <SettingsPage />,
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              { path: 'profile', element: <ProfileSettings /> },
              { path: 'account', element: <AccountSettings /> },
              { path: 'appearance', element: <AppearanceSettings /> },
              { path: 'demo', element: <DemoDataSettings /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
