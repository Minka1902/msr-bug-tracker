import { Database, Eye, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/dates';
import { useDemoStatus, useGenerateDemo, useImpersonate, useRemoveDemo } from '../../demo/api';
import { SettingsSection } from '../components/SettingsSection';

const ROLE_TONES: Record<string, 'accent' | 'info' | 'warning' | 'neutral'> = {
  Admin: 'accent',
  Member: 'info',
  QA: 'warning',
  Viewer: 'neutral',
};

export function DemoDataSettings() {
  const generate = async () => {
    if (
      status.data?.exists &&
      !(await confirm({
        title: 'Replace demo data?',
        description:
          'Your current demo projects, teammates and their changes are removed first. Your own projects are never touched.',
        confirmLabel: 'Replace',
        tone: 'primary',
      }))
    )
      return;
    const parsedSeed = Number(seed);
    create.mutate(
      { size, seed: seed && Number.isInteger(parsedSeed) && parsedSeed > 0 ? parsedSeed : undefined },
      {
        onSuccess: ({ status: next }) =>
          toast.success(
            `Generated ${next.counts.tasks} tasks in ${next.counts.projects} projects (seed ${next.seed})`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const remove = async () => {
    if (
      await confirm({
        title: 'Remove all demo data?',
        description: 'Only demo projects and demo teammates are deleted.',
        confirmLabel: 'Remove',
      })
    )
      del.mutate(undefined, {
        onSuccess: () => toast.success('Demo data removed'),
        onError: (error) => toast.error(errorMessage(error)),
      });
  };

  const viewAs = (id: string) =>
    impersonate.mutate(id, {
      onSuccess: ({ user }) => {
        navigate('/');
        toast.success(`Now viewing as ${user.name}`);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  const navigate = useNavigate();
  const confirm = useConfirm();
  const status = useDemoStatus();
  const create = useGenerateDemo();
  const del = useRemoveDemo();
  const impersonate = useImpersonate();
  const [size, setSize] = useState<'small' | 'large'>('small');
  const [seed, setSeed] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Generate demo data"
        description="Fill the app with realistic projects, tasks, bugs, comments and teammates so you can test everything without creating data by hand."
        footer={
          <>
            {status.data?.exists && (
              <Button variant="danger-ghost" leftIcon={<Trash2 />} loading={del.isPending} onClick={remove}>
                Remove demo data
              </Button>
            )}
            <Button leftIcon={<Sparkles />} loading={create.isPending} onClick={generate}>
              {status.data?.exists ? 'Regenerate' : 'Generate'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <ChoiceGroup
            label="Size"
            columns={2}
            value={size}
            onChange={setSize}
            choices={[
              {
                value: 'small',
                label: 'Small',
                description: '3 active projects + 1 archived, about 80 tasks',
              },
              {
                value: 'large',
                label: 'Large',
                description: '8 projects, about 2,300 tasks — for performance testing',
              },
            ]}
          />
          <Field
            label="Seed"
            htmlFor="demo-seed"
            hint="Optional. The same seed always produces the same data, which helps reproduce bugs."
          >
            <Input
              id="demo-seed"
              inputMode="numeric"
              value={seed}
              onChange={(event) => setSeed(event.target.value.replace(/\D/g, ''))}
              placeholder="Random"
              className="max-w-40"
            />
          </Field>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Current demo set"
        description="Demo projects carry a Demo badge. One project is owned by a teammate and shared with you, and one is archived."
      >
        {status.isPending && <Skeleton className="h-16" />}
        {status.data && !status.data.exists && (
          <EmptyState compact icon={<Database />} title="No demo data yet" />
        )}
        {status.data?.exists && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="violet" label={`${status.data.counts.projects} projects`} />
              <Badge tone="info" label={`${status.data.counts.tasks} tasks`} />
              <Badge label={`Seed ${status.data.seed}`} />
              <Badge label={status.data.size === 'large' ? 'Large' : 'Small'} />
              {status.data.generatedAt && (
                <span className="text-xs text-muted">
                  Generated {formatDateTime(status.data.generatedAt)}
                </span>
              )}
            </div>
            <Banner tone="info" icon={<Eye />}>
              Use “View as” to experience the app with a teammate's role — for example, QA can report bugs but
              can't assign others, and Viewer is read-only.
            </Banner>
            <div className="flex flex-col divide-y divide-border">
              {status.data.teammates.map((mate) => (
                <div key={mate.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={mate.name} size="md" decorative />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{mate.name}</p>
                    <p className="truncate text-xs text-muted">{mate.email}</p>
                  </div>
                  <Badge tone={ROLE_TONES[mate.roleName] ?? 'neutral'} label={mate.roleName} />
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Eye />}
                    aria-label={`View as ${mate.name}`}
                    loading={impersonate.isPending && impersonate.variables === mate.id}
                    onClick={() => viewAs(mate.id)}
                  >
                    View as
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
