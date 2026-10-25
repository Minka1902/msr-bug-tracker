import { Mail, MessageCircle, Send, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';

export type ShareChannel = 'whatsapp' | 'telegram' | 'email' | 'native';

interface ShareLinksProps {
  url: string;
  message: string;
  subject?: string;
  channels?: ShareChannel[];
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const ALL_CHANNELS: ShareChannel[] = ['whatsapp', 'telegram', 'email', 'native'];

const LINKS: Record<
  Exclude<ShareChannel, 'native'>,
  { label: string; icon: ReactNode; href: (url: string, message: string, subject: string) => string }
> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: <MessageCircle />,
    href: (url, message) => `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`,
  },
  telegram: {
    label: 'Telegram',
    icon: <Send />,
    href: (url, message) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
  },
  email: {
    label: 'Email',
    icon: <Mail />,
    href: (url, message, subject) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`,
  },
};

export function ShareLinks({
  url,
  message,
  subject = message,
  channels = ALL_CHANNELS,
  size = 'sm',
  className,
}: ShareLinksProps) {
  const canShareNatively = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {channels.map((channel) =>
        channel === 'native' ? (
          canShareNatively && (
            <Button
              key={channel}
              size={size}
              variant="secondary"
              leftIcon={<Share2 />}
              onClick={() => navigator.share({ title: subject, text: message, url }).catch(() => undefined)}
            >
              More…
            </Button>
          )
        ) : (
          <Button key={channel} asChild size={size} variant="secondary" leftIcon={LINKS[channel].icon}>
            <a href={LINKS[channel].href(url, message, subject)} target="_blank" rel="noopener noreferrer">
              {LINKS[channel].label}
            </a>
          </Button>
        ),
      )}
    </div>
  );
}
