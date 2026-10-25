import { Share } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Banner } from '../../components/ui/Banner';
import { useLocalState } from '../../hooks/useLocalState';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const INSTALL_PATH = '/settings/install';

export function InstallHint() {
  const { pathname } = useLocation();
  const install = usePwaInstall();
  const [dismissed, setDismissed] = useLocalState('msr-install-hint-dismissed', false);

  if (!install.ios || install.standalone || dismissed || pathname === INSTALL_PATH) return null;
  return (
    <Banner tone="accent" icon={<Share />} onDismiss={() => setDismissed(true)}>
      Install MSR on your iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.{' '}
      <Link to={INSTALL_PATH} className="font-medium underline underline-offset-2">
        Show me how
      </Link>
    </Banner>
  );
}
