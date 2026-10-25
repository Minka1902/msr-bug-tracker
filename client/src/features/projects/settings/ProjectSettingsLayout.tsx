import { Outlet } from 'react-router';
import { TabLinks } from '../../../components/ui/TabLinks';
import { useProjectContext } from '../useProjectContext';

export function ProjectSettingsLayout() {
  const project = useProjectContext();
  const base = `/p/${project.key}/settings`;

  return (
    <div className="flex flex-col gap-4">
      <TabLinks
        label="Project settings"
        variant="pill"
        className="self-start max-w-full"
        items={[
          { to: `${base}/general`, label: 'General' },
          { to: `${base}/workflows`, label: 'Workflows' },
          { to: `${base}/labels`, label: 'Labels' },
          { to: `${base}/members`, label: 'Members', count: project.memberCount },
          { to: `${base}/roles`, label: 'Roles' },
          { to: `${base}/danger`, label: 'Danger zone' },
        ]}
      />
      <Outlet context={{ project }} />
    </div>
  );
}
