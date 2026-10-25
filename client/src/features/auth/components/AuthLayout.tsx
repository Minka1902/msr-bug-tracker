import { Bug, KanbanSquare, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../../../components/layout/Logo';
import { Card } from '../../../components/ui/Card';

const HIGHLIGHTS = [
  { icon: KanbanSquare, title: 'Boards & lists', text: 'Drag work across custom workflows.' },
  { icon: Bug, title: 'Real bug tracking', text: 'Severity, repro steps, environments.' },
  { icon: ShieldCheck, title: 'Roles that fit', text: 'Decide exactly who can do what.' },
];

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-stretch md:p-(--shell-margin)">
      <div className="flex flex-1 overflow-hidden md:rounded-(--shell-radius) md:bg-app md:shadow-[0_30px_80px_-30px_rgb(15_23_42/0.5)] clean:md:shadow-none">
        <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#0f1735,#2a2f8f_55%,#4f56f0)] p-10 text-white lg:flex clean:bg-[linear-gradient(150deg,#0f2a1c,#14532d_60%,#17844b)]">
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <Logo className="relative [&_span:last-child]:text-white" />
          <div className="relative flex max-w-md flex-col gap-8">
            <h2 className="text-4xl leading-tight font-bold">Every project and bug, in one calm place.</h2>
            <div className="flex flex-col gap-4">
              {HIGHLIGHTS.map(({ icon: Icon, title: heading, text }) => (
                <div
                  key={heading}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur"
                >
                  <Icon className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{heading}</p>
                    <p className="text-sm text-white/75">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-sm text-white/60">MSR Tracker</p>
        </section>
        <section className="flex flex-1 flex-col items-center justify-center bg-app px-4 py-10 pt-safe">
          <Logo className="mb-8 lg:hidden" />
          <Card padding="lg" className="w-full max-w-md">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </Card>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </section>
      </div>
    </div>
  );
}
