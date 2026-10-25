import { CircleAlert, CircleCheck, Download, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PRIORITY_META, TYPE_META, type Priority, type TaskType } from '@msr/shared/enums';
import type { ProjectDetail } from '@msr/shared/types';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { FileDropzone } from '../../../components/ui/FileDropzone';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { errorMessage } from '../../../lib/api';
import { downloadUrl } from '../../../lib/download';
import { templateUrl, useCommitImport, usePreviewImport, type ImportField, type ImportPreview } from '../api';

interface ImportTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Pick<ProjectDetail, 'key' | 'name'>;
}

const IGNORE = '__ignore__';
const FIELD_LABELS: Record<ImportField, string> = {
  title: 'Title',
  type: 'Type',
  status: 'Status',
  priority: 'Priority',
  severity: 'Severity',
  assignee: 'Assignee',
  labels: 'Labels',
  startDate: 'Start date',
  dueDate: 'Due date',
  description: 'Description',
  stepsToReproduce: 'Steps to reproduce',
  expectedBehavior: 'Expected result',
  actualBehavior: 'Actual result',
  externalId: 'ID',
  parentExternalId: 'Parent ID',
  createdAt: 'Created date',
};
const FIELD_OPTIONS = [
  { value: IGNORE, label: "Don't import" },
  ...Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label })),
];

export function ImportTasksModal({ open, onOpenChange, project }: ImportTasksModalProps) {
  const close = () => {
    onOpenChange(false);
    setFile(null);
    setMapping(undefined);
    preview.reset();
    commit.reset();
  };

  const choose = (files: File[]) => {
    const [next] = files;
    if (!next) return;
    setFile(next);
    setMapping(undefined);
    preview.mutate({ file: next });
  };

  const remap = (header: string, field: string | null) => {
    if (!file || !preview.data) return;
    const next = { ...preview.data.mapping, [header]: field === IGNORE ? null : (field as ImportField) };
    setMapping(next);
    preview.mutate({ file, mapping: next });
  };

  const runImport = () =>
    file &&
    commit.mutate(
      { file, mapping },
      { onSuccess: (result) => toast.success(`Imported ${result.created} tasks into ${project.name}`) },
    );

  const preview = usePreviewImport(project.key);
  const commit = useCommitImport(project.key);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<ImportPreview['mapping'] | undefined>();
  const data = preview.data;
  const error = preview.error ?? commit.error;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={`Import tasks into ${project.name}`}
      description="Upload a CSV or Excel file. Exports from ClickUp, Jira, Asana, Trello and Linear work too."
      size="lg"
      footer={
        commit.data ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            {data && (
              <Button
                loading={commit.isPending}
                disabled={!data.valid || data.missingTitle || preview.isPending}
                onClick={runImport}
              >
                Import {data.valid} {data.valid === 1 ? 'task' : 'tasks'}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(error)}
          </Banner>
        )}
        {commit.data ? (
          <div className="flex flex-col gap-3">
            <Banner tone="success" icon={<CircleCheck />}>
              Created {commit.data.created} {commit.data.created === 1 ? 'task' : 'tasks'}
              {commit.data.skipped.length > 0 && `, skipped ${commit.data.skipped.length} rows`}.
            </Banner>
            {commit.data.warnings.length > 0 && (
              <Banner tone="warning" icon={<TriangleAlert />}>
                <ul className="flex flex-col gap-0.5">
                  {commit.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Banner>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Start from a template:</span>
              <Button
                size="xs"
                variant="secondary"
                leftIcon={<Download />}
                onClick={() => downloadUrl(templateUrl('xlsx'))}
              >
                Excel template
              </Button>
              <Button
                size="xs"
                variant="secondary"
                leftIcon={<Download />}
                onClick={() => downloadUrl(templateUrl('csv'))}
              >
                CSV template
              </Button>
            </div>
            <FileDropzone
              multiple={false}
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              loading={preview.isPending && !data}
              onFiles={choose}
              hint={
                file ? (
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="size-4" /> {file.name} · drop another file to replace it
                  </span>
                ) : (
                  'Drop a .csv or .xlsx file here, or click to choose one'
                )
              }
            />
            {data && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge label={`${data.total} rows`} />
                  <Badge tone="success" label={`${data.valid} ready`} />
                  {data.skipped.length > 0 && (
                    <Badge tone="warning" label={`${data.skipped.length} skipped`} />
                  )}
                </div>
                {data.missingTitle && (
                  <Banner tone="warning" icon={<TriangleAlert />}>
                    Pick which column holds the task title.
                  </Banner>
                )}
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Columns</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.headers.map((header) => (
                      <div key={header} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={header}>
                          {header}
                        </span>
                        <OptionPicker
                          aria-label={`Import column ${header} as`}
                          value={data.mapping[header] ?? IGNORE}
                          onChange={(field) => remap(header, field)}
                          options={FIELD_OPTIONS}
                          className="h-8 w-44 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </section>
                {data.warnings.length > 0 && (
                  <Banner tone="warning" icon={<TriangleAlert />}>
                    <ul className="flex flex-col gap-0.5">
                      {data.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </Banner>
                )}
                {data.skipped.length > 0 && (
                  <Banner tone="danger" icon={<CircleAlert />}>
                    <ul className="flex flex-col gap-0.5">
                      {data.skipped.slice(0, 10).map((issue) => (
                        <li key={issue.row}>
                          Row {issue.row}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </Banner>
                )}
                {data.sample.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Preview</h3>
                    <div className="overflow-x-auto rounded-control border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-muted text-muted">
                          <tr>
                            {['Row', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Due'].map(
                              (heading) => (
                                <th key={heading} className="px-2 py-1.5 font-medium whitespace-nowrap">
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.sample.map((row) => (
                            <tr key={row.row}>
                              <td className="px-2 py-1.5 text-muted">{row.row}</td>
                              <td className="max-w-64 truncate px-2 py-1.5 font-medium">{row.title}</td>
                              <td className="px-2 py-1.5">
                                {TYPE_META[row.type as TaskType]?.label ?? row.type}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{row.status}</td>
                              <td className="px-2 py-1.5">
                                {PRIORITY_META[row.priority as Priority]?.label ?? row.priority}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{row.assignee ?? '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{row.dueDate ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
