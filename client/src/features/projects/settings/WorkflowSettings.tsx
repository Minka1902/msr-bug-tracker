import { WORKFLOWS } from '@msr/shared/enums';
import { Banner } from '../../../components/ui/Banner';
import { useProjectContext } from '../useProjectContext';
import { WorkflowEditor } from './WorkflowEditor';

export function WorkflowSettings() {
  const project = useProjectContext();

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="info">
        Tasks, features and improvements use the task workflow; bugs use the bug workflow. Categories drive
        progress: anything in a <strong>Done</strong> status counts as completed.
      </Banner>
      <div className="grid gap-4 lg:grid-cols-2">
        {WORKFLOWS.map((workflow) => (
          <WorkflowEditor
            key={workflow}
            projectKey={project.key}
            workflow={workflow}
            statuses={project.statuses.filter((status) => status.workflow === workflow)}
          />
        ))}
      </div>
    </div>
  );
}
