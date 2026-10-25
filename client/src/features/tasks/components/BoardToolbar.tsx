import { Rows3 } from 'lucide-react';
import { WORKFLOW_META, WORKFLOWS, type Workflow } from '@msr/shared/enums';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Button } from '../../../components/ui/Button';
import { GROUP_OPTIONS, type GroupBy } from '../board/groupTasks';

interface BoardToolbarProps {
  workflow?: Workflow;
  onWorkflowChange?: (workflow: Workflow) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
}

export function BoardToolbar({ workflow, onWorkflowChange, groupBy, onGroupByChange }: BoardToolbarProps) {
  return (
    <>
      {workflow && onWorkflowChange && (
        <SegmentedControl
          size="sm"
          label="Workflow"
          value={workflow}
          onChange={onWorkflowChange}
          options={WORKFLOWS.map((value) => ({ value, label: WORKFLOW_META[value].label }))}
        />
      )}
      <OptionPicker
        aria-label="Group by"
        value={groupBy}
        onChange={(value) => value && onGroupByChange(value as GroupBy)}
        options={GROUP_OPTIONS}
        renderTrigger={(selected) => (
          <Button size="sm" variant="ghost" leftIcon={<Rows3 />}>
            {groupBy === 'none' ? 'Group' : `Group: ${selected[0]?.label}`}
          </Button>
        )}
      />
    </>
  );
}
