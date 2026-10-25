import { CircleCheck, Download, Ellipsis, Share, Smartphone, SquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { SettingsSection } from '../settings/components/SettingsSection';
import { StepList } from '../settings/components/StepList';

const IPHONE_STEPS = [
  { icon: <Smartphone />, text: 'Open this site in Safari on your iPhone.' },
  { icon: <Share />, text: 'Tap the Share button in the toolbar (in iOS 26, tap ··· first).' },
  { icon: <SquarePlus />, text: 'Scroll down and tap Add to Home Screen.' },
  { icon: <CircleCheck />, text: 'Tap Add. MSR opens full-screen from its home-screen icon.' },
];

const OTHER_STEPS = [
  { icon: <Ellipsis />, text: 'Android (Chrome): open the ⋮ menu and tap Install app.' },
  { icon: <Download />, text: 'Desktop (Chrome or Edge): click the install icon in the address bar.' },
];

export const installUrl = () => `${window.location.origin}/install`;

export function InstallGuide() {
  const install = async () => {
    if (await promptInstall()) toast.success('MSR installed');
  };

  const { ios, standalone, canPrompt, promptInstall } = usePwaInstall();

  return (
    <div className="flex flex-col gap-4">
      {standalone && (
        <Banner tone="success" icon={<CircleCheck />}>
          You're using the installed app.
        </Banner>
      )}
      <SettingsSection
        title="iPhone & iPad"
        description="Add MSR to your home screen. It opens full-screen like a native app and updates itself."
      >
        <div className="flex flex-col gap-4">
          {ios && !standalone && (
            <Badge tone="accent" className="self-start">
              You're on an iOS device
            </Badge>
          )}
          <StepList steps={IPHONE_STEPS} />
        </div>
      </SettingsSection>
      <SettingsSection
        title="Android & desktop"
        description="Chromium browsers can install MSR as an app too."
        footer={
          canPrompt && (
            <Button leftIcon={<Download />} onClick={install}>
              Install app
            </Button>
          )
        }
      >
        <StepList steps={OTHER_STEPS} />
      </SettingsSection>
    </div>
  );
}
