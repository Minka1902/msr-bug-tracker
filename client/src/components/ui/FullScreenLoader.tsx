import { Logo } from '../layout/Logo';
import { Spinner } from './Spinner';

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo compact />
      <Spinner className="size-5 text-muted" />
    </div>
  );
}
