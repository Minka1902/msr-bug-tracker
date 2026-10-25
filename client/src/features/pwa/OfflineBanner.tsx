import { WifiOff } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;
  return (
    <Banner tone="warning" icon={<WifiOff />}>
      You're offline. Changes can't be saved until you reconnect.
    </Banner>
  );
}
