import { Outlet } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { TabLinks } from '../../../components/ui/TabLinks';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useAppConfig } from '../../demo/api';

const TABS = [
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/account', label: 'Account' },
  { to: '/settings/security', label: 'Security' },
  { to: '/settings/ai', label: 'AI' },
  { to: '/settings/connected-apps', label: 'Connected apps' },
  { to: '/settings/calendars', label: 'Calendars' },
  { to: '/settings/appearance', label: 'Appearance' },
  { to: '/settings/install', label: 'Install app' },
];

export function SettingsPage() {
  const config = useAppConfig();
  const user = useCurrentUser();
  const tabs = [
    ...TABS,
    ...(config.data?.features.demoData && !user.impersonator
      ? [{ to: '/settings/demo', label: 'Demo data' }]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader title="Settings" description="Manage your profile, account and how the app looks.">
        <TabLinks label="Settings" items={tabs} />
      </PageHeader>
      <Outlet />
    </div>
  );
}
