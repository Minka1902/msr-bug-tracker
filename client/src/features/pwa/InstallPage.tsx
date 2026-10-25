import { Link } from 'react-router';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';
import { InstallGuide } from './InstallGuide';

export function InstallPage() {
  return (
    <main className="min-h-dvh bg-app px-4 pt-safe pb-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 pt-8">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">Install MSR Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            MSR runs as an app from your home screen — no app store needed. Follow the steps for your phone.
          </p>
        </div>
        <InstallGuide />
        <Button asChild size="lg" className="self-start">
          <Link to="/">Open MSR Tracker</Link>
        </Button>
      </div>
    </main>
  );
}
