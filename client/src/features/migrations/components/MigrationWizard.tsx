import { ArrowLeft, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { can } from '@msr/shared/permissions';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { useProjects } from '../../projects/api';
import { ImportTasksModal } from '../../importExport/components/ImportTasksModal';
import {
  useCommitMigration,
  useDiscardMigration,
  useMigrationJob,
  useMigrationSources,
  useStartMigration,
} from '../api';
import type { MigrationTool } from '../tools';
import { CredentialsStep } from './CredentialsStep';
import { JobProgress } from './JobProgress';
import { MappingStep } from './MappingStep';
import { SourceStep, type SourceChoice } from './SourceStep';
import { ToolPicker } from './ToolPicker';

interface MigrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'tool' | 'file' | 'connect' | 'source' | 'job';

const FORM_ID = 'migration-step';
const DEFAULT_CHOICE: SourceChoice = { sourceId: null, includeComments: true, includeClosed: true };

export function MigrationWizard({ open, onOpenChange }: MigrationWizardProps) {
  const reset = () => {
    setStep('tool');
    setTool(null);
    setCredentials({});
    setChoice(DEFAULT_CHOICE);
    setJobId(null);
    sources.reset();
    start.reset();
    commit.reset();
  };

  const close = () => {
    if (jobId && job.data?.status !== 'importing') discard.mutate(jobId);
    onOpenChange(false);
    reset();
  };

  const connect = (values: Record<string, string>) => {
    setCredentials(values);
    sources.mutate(values, { onSuccess: () => setStep('source') });
  };

  const startJob = () =>
    choice.sourceId &&
    start.mutate(
      {
        credentials,
        sourceId: choice.sourceId,
        includeComments: choice.includeComments,
        includeClosed: choice.includeClosed,
      },
      {
        onSuccess: (created) => {
          setJobId(created.id);
          setStep('job');
        },
      },
    );

  const back = () => {
    if (step === 'source') return setStep('connect');
    if (jobId) discard.mutate(jobId);
    reset();
  };

  const navigate = useNavigate();
  const projects = useProjects();
  const [step, setStep] = useState<Step>('tool');
  const [tool, setTool] = useState<MigrationTool | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<SourceChoice>(DEFAULT_CHOICE);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileProject, setFileProject] = useState<string | null>(null);
  const [fileImport, setFileImport] = useState(false);
  const sources = useMigrationSources(tool?.id ?? '');
  const start = useStartMigration(tool?.id ?? '');
  const job = useMigrationJob(jobId);
  const commit = useCommitMigration(jobId);
  const discard = useDiscardMigration();
  const status = job.data?.status;
  const importable = (projects.data ?? []).filter(
    (project) => !project.isArchived && can(project.permissions, 'task.create'),
  );
  const chosenFileProject = importable.find((project) => project.key === fileProject);

  const footer = (() => {
    if (step === 'tool') return null;
    if (step === 'job' && status === 'done')
      return (
        <Button
          onClick={() => {
            const key = job.data!.result!.projectKey;
            close();
            navigate(`/p/${key}/list`);
          }}
        >
          Open project
        </Button>
      );
    const backButton = (
      <Button variant="ghost" leftIcon={<ArrowLeft />} onClick={back} className="mr-auto">
        Back
      </Button>
    );
    if (step === 'file')
      return (
        <>
          {backButton}
          <Button disabled={!chosenFileProject} onClick={() => setFileImport(true)}>
            Choose file
          </Button>
        </>
      );
    if (step === 'connect')
      return (
        <>
          {backButton}
          <Button type="submit" form={FORM_ID} loading={sources.isPending}>
            Connect
          </Button>
        </>
      );
    if (step === 'source')
      return (
        <>
          {backButton}
          <Button loading={start.isPending} disabled={!choice.sourceId} onClick={startJob}>
            Read {tool?.sourceLabel.toLowerCase()}
          </Button>
        </>
      );
    if (status === 'ready')
      return (
        <>
          {backButton}
          <Button type="submit" form={FORM_ID} loading={commit.isPending}>
            Import {job.data!.total} items
          </Button>
        </>
      );
    if (status === 'failed') return backButton;
    return null;
  })();

  return (
    <>
      <Modal
        open={open && !fileImport}
        onOpenChange={(next) => !next && close()}
        title={tool ? `Import from ${tool.label}` : 'Move your work to MSR Tracker'}
        description={
          step === 'tool'
            ? 'Bring tasks, statuses, people and comments over from the tool you use today.'
            : undefined
        }
        size="lg"
        footer={footer}
      >
        {step === 'tool' && (
          <ToolPicker
            onPick={(picked) => {
              setTool(picked);
              setStep('connect');
            }}
            onPickFile={() => setStep('file')}
          />
        )}
        {step === 'file' && (
          <Field label="Import into which project?">
            <OptionPicker
              aria-label="Project"
              searchable
              placeholder="Choose a project"
              value={fileProject}
              onChange={setFileProject}
              options={importable.map((project) => ({
                value: project.key,
                label: project.name,
                description: project.key,
              }))}
              className="w-full"
            />
          </Field>
        )}
        {step === 'connect' && tool && (
          <CredentialsStep tool={tool} formId={FORM_ID} error={sources.error} onSubmit={connect} />
        )}
        {step === 'source' && tool && sources.data && (
          <div className="flex flex-col gap-4">
            {start.error && (
              <Banner tone="danger" icon={<CircleAlert />}>
                {start.error.message}
              </Banner>
            )}
            <SourceStep tool={tool} sources={sources.data} value={choice} onChange={setChoice} />
          </div>
        )}
        {step === 'job' && job.data && (
          <>
            {(status === 'fetching' || status === 'importing') && <JobProgress job={job.data} />}
            {status === 'failed' && (
              <Banner tone="danger" icon={<CircleAlert />}>
                {job.data.error}
              </Banner>
            )}
            {status === 'ready' && (
              <MappingStep
                job={job.data}
                formId={FORM_ID}
                error={commit.error}
                onSubmit={(input) => commit.mutate(input)}
              />
            )}
            {status === 'done' && job.data.result && (
              <div className="flex flex-col gap-3">
                <Banner tone="success" icon={<CircleCheck />}>
                  Imported {job.data.result.created} items
                  {job.data.result.skipped > 0 && ` (${job.data.result.skipped} skipped)`}.
                </Banner>
                {job.data.result.warnings.length > 0 && (
                  <Banner tone="warning" icon={<TriangleAlert />}>
                    <ul className="flex flex-col gap-0.5">
                      {job.data.result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </Banner>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
      {chosenFileProject && (
        <ImportTasksModal
          open={fileImport}
          onOpenChange={(next) => {
            setFileImport(next);
            if (!next) close();
          }}
          project={chosenFileProject}
        />
      )}
    </>
  );
}
