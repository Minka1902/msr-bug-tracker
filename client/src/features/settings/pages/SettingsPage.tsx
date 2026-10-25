import { Outlet } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { TabLinks } from '../../../components/ui/TabLinks';

const TABS = [
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/account', label: 'Account' },
  { to: '/settings/appearance', label: 'Appearance' },
];

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader title="Settings" description="Manage your profile, account and how the app looks.">
        <TabLinks items={TABS} />
      </PageHeader>
      <Outlet />
    </div>
  );
}
