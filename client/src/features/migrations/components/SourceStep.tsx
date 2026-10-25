import { Field } from '../../../components/ui/Field';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { Switch } from '../../../components/ui/Switch';
import type { SourceOption } from '../api';
import type { MigrationTool } from '../tools';

export interface SourceChoice {
  sourceId: string | null;
  includeComments: boolean;
  includeClosed: boolean;
}

interface SourceStepProps {
  tool: MigrationTool;
  sources: SourceOption[];
  value: SourceChoice;
  onChange: (value: SourceChoice) => void;
}

export function SourceStep({ tool, sources, value, onChange }: SourceStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field label={`${tool.sourceLabel} to import`}>
        <OptionPicker
          aria-label={`${tool.sourceLabel} to import`}
          searchable
          placeholder={sources.length ? `Choose a ${tool.sourceLabel.toLowerCase()}` : 'Nothing found'}
          value={value.sourceId}
          onChange={(sourceId) => onChange({ ...value, sourceId })}
          options={sources.map((source) => ({
            value: source.id,
            label: source.name,
            group: source.group ?? undefined,
          }))}
          className="w-full"
          contentClassName="w-[min(28rem,calc(100vw-2rem))]"
        />
      </Field>
      <div className="flex flex-col gap-3">
        <Switch
          checked={value.includeClosed}
          onCheckedChange={(includeClosed) => onChange({ ...value, includeClosed })}
          label="Include closed and completed items"
        />
        <Switch
          checked={value.includeComments}
          onCheckedChange={(includeComments) => onChange({ ...value, includeComments })}
          label="Include comments"
          description="Large imports take longer with comments, because each tool limits how fast we can read them."
        />
      </div>
    </div>
  );
}
