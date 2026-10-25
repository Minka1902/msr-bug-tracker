import { useState } from 'react';
import { can } from '@msr/shared/permissions';
import type { TaskDetail } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ProjectAvatar } from '../../../components/ui/ProjectAvatar';
import { useProjects } from '../../projects/api';

interface MoveTaskModalProps {
  task: TaskDetail | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (projectKey: string) => void;
}

export function MoveTaskModal({ task, loading, onCancel, onConfirm }: MoveTaskModalProps) {
  const projects = useProjects();
  const [target, setTarget] = useState<string | null>(null);
  const options = (projects.data ?? [])
    .filter((project) => project.key !== task?.projectKey && can(project.permissions, 'task.create'))
    .map((project) => ({
      value: project.key,
      label: project.name,
      description: project.key,
      icon: <ProjectAvatar color={project.color} icon={project.icon} size="xs" />,
    }));

  return (
    <Modal
      open={!!task}
      onOpenChange={(open) => !open && onCancel()}
      size="sm"
      title={`Move ${task?.identifier}`}
      description="It gets a new ID in the target project. Old links keep working."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!target} loading={loading} onClick={() => target && onConfirm(target)}>
            Move task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Target project">
          <OptionPicker
            aria-label="Target project"
            value={target}
            onChange={setTarget}
            options={options}
            searchable
            emptyText="No other projects where you can create tasks"
            className="w-full"
          />
        </Field>
        <Banner tone="info">
          Statuses are matched by category, labels by name, and assignees who aren't members of the target are
          cleared. Subtasks move too.
        </Banner>
      </div>
    </Modal>
  );
}
