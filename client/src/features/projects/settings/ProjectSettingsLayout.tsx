import { Navigate, Outlet, useMatch } from 'react-router';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TabLinks } from '../../../components/ui/TabLinks';
import { useProjectContext } from '../useProjectContext';
import { useSettingsTabs } from './useSettingsTabs';

export function ProjectSettingsLayout() {
  const project = useProjectContext();
  const { tabs, pending } = useSettingsTabs(project);
  const current = useMatch('/p/:key/settings/:tab')?.params.tab;
  const base = `/p/${project.key}/settings`;

  if (pending) return <Skeleton className="h-64 rounded-card" />;
  if (!tabs.some((tab) => tab.path === current)) return <Navigate to={`${base}/${tabs[0]!.path}`} replace />;

  return (
    <div className="flex flex-col gap-4">
      <TabLinks
        label="Project settings"
        variant="pill"
        className="self-start max-w-full"
        items={tabs.map(({ path, label, count }) => ({ to: `${base}/${path}`, label, count }))}
      />
      <Outlet context={{ project }} />
    </div>
  );
}
