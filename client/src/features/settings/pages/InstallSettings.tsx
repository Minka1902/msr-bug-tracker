import { QrCode } from '../../../components/ui/QrCode';
import { ShareLinks } from '../../invites/components/ShareLinks';
import { InstallGuide, installUrl } from '../../pwa/InstallGuide';
import { SettingsSection } from '../components/SettingsSection';

export function InstallSettings() {
  const url = installUrl();

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Get it on your phone"
        description="Scan the code with your phone's camera to open the install steps there, or send the link to someone."
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <QrCode value={url} size={168} title="Install MSR Tracker QR code" downloadName="msr-install" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <code className="rounded-control border border-border bg-surface-muted/60 px-3 py-2 font-mono text-xs break-all">
              {url}
            </code>
            <ShareLinks
              url={url}
              message="Install MSR Tracker on your phone:"
              subject="Install MSR Tracker"
            />
          </div>
        </div>
      </SettingsSection>
      <InstallGuide />
    </div>
  );
}
