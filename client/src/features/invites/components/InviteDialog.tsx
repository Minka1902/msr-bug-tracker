import { CircleAlert, Copy, Link2, Mail, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { isSubsetOf } from '@msr/shared/permissions';
import type { CreatedInvite, ProjectDetail } from '@msr/shared/types';
import { Banner } from '../../../components/ui/Banner';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { QrCode } from '../../../components/ui/QrCode';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { formatShortDate } from '../../../lib/dates';
import { useCreateInvite } from '../api';
import { ShareLinks } from './ShareLinks';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Pick<ProjectDetail, 'key' | 'name' | 'roles' | 'permissions'>;
  defaultEmail?: string;
}

type Mode = 'link' | 'email';
type Reach = 'one' | 'group' | 'anyone';

const REACH_USES: Record<Reach, number | null> = { one: 1, group: 25, anyone: null };
const REACH_OPTIONS = [
  { value: 'one' as const, label: 'One person' },
  { value: 'group' as const, label: 'Up to 25' },
  { value: 'anyone' as const, label: 'Anyone' },
];
const MODE_OPTIONS = [
  { value: 'link' as const, label: 'Share a link', icon: <Link2 /> },
  { value: 'email' as const, label: 'Send email', icon: <Mail /> },
];

export function InviteDialog({ open, onOpenChange, project, defaultEmail = '' }: InviteDialogProps) {
  const close = () => {
    onOpenChange(false);
    setInvite(null);
    setEmail(defaultEmail);
    create.reset();
  };

  const createLink = () =>
    create.mutate(
      { projectKey: project?.key, roleId: chosenRoleId ?? undefined, maxUses: REACH_USES[reach] },
      { onSuccess: setInvite },
    );

  const sendEmail = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { projectKey: project?.key, roleId: chosenRoleId ?? undefined, email: email.trim(), maxUses: 1 },
      {
        onSuccess: (sent) => {
          toast.success(`Invite sent to ${sent.email}`);
          setEmail('');
        },
      },
    );
  };

  const user = useCurrentUser();
  const create = useCreateInvite();
  const [mode, setMode] = useState<Mode>(defaultEmail ? 'email' : 'link');
  const [reach, setReach] = useState<Reach>('one');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const grantable = (project?.roles ?? []).filter(
    (role) => role.systemKey !== 'owner' && isSubsetOf(role.permissions, project!.permissions),
  );
  const chosenRoleId = project
    ? (roleId ?? grantable.find((role) => role.systemKey === 'member')?.id ?? grantable[0]?.id ?? null)
    : null;
  const message = project
    ? `${user.name} invited you to join "${project.name}" on MSR Tracker.`
    : `${user.name} invited you to MSR Tracker.`;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={project ? `Invite people to ${project.name}` : 'Invite people to MSR Tracker'}
      description={
        project
          ? 'They join the project with the role you pick as soon as they sign in or create an account.'
          : 'Share a link so friends and teammates can create an account.'
      }
      footer={
        <Button variant="secondary" onClick={close}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {create.error && (
          <Banner tone="danger" icon={<CircleAlert />}>
            {errorMessage(create.error)}
          </Banner>
        )}
        {project && (
          <Field label="Role">
            <OptionPicker
              aria-label="Role"
              value={chosenRoleId}
              onChange={(next) => {
                setRoleId(next);
                setInvite(null);
              }}
              options={grantable.map((role) => ({ value: role.id, label: role.name }))}
              className="w-full sm:w-56"
            />
          </Field>
        )}
        <SegmentedControl label="How to invite" value={mode} onChange={setMode} options={MODE_OPTIONS} block />
        {mode === 'email' && (
          <form onSubmit={sendEmail} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
            <Field label="Email address" htmlFor="invite-email" className="flex-1">
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="friend@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Button type="submit" leftIcon={<Mail />} loading={create.isPending} disabled={!email.includes('@')}>
              Send invite
            </Button>
          </form>
        )}
        {mode === 'link' && !invite && (
          <div className="flex flex-col gap-3">
            <Field label="Who can use the link" hint="Links expire after 7 days. You can revoke them any time.">
              <SegmentedControl label="Who can use the link" value={reach} onChange={setReach} options={REACH_OPTIONS} />
            </Field>
            <Button leftIcon={<Link2 />} loading={create.isPending} onClick={createLink} className="self-start">
              Create invite link
            </Button>
          </div>
        )}
        {mode === 'link' && invite && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <QrCode value={invite.url} size={160} title="Invite QR code" downloadName="msr-invite" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Field
                label="Invite link"
                htmlFor="invite-url"
                hint={`${invite.maxUses === null ? 'Anyone with the link' : invite.maxUses === 1 ? 'One person' : `Up to ${invite.maxUses} people`} · expires ${formatShortDate(invite.expiresAt)}`}
              >
                <Input
                  id="invite-url"
                  readOnly
                  value={invite.url}
                  onFocus={(event) => event.target.select()}
                  className="font-mono text-xs"
                  rightSlot={
                    <IconButton
                      icon={<Copy />}
                      label="Copy invite link"
                      size="xs"
                      onClick={() => copyText(invite.url, 'Invite link')}
                    />
                  }
                />
              </Field>
              <ShareLinks url={invite.url} message={message} channels={['whatsapp', 'telegram', 'native']} />
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<RotateCcw />}
                className="self-start"
                onClick={() => setInvite(null)}
              >
                Create another link
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
