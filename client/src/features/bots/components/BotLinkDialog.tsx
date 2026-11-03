import { ExternalLink, Send } from 'lucide-react';
import { BOT_PLATFORM_META } from '@msr/shared/bots';
import type { BotLink } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { Modal } from '../../../components/ui/Modal';
import { QrCode } from '../../../components/ui/QrCode';

interface BotLinkDialogProps {
  link: (BotLink & { isGroup: boolean }) | null;
  botName: string | null;
  onOpenChange: (open: boolean) => void;
}

const ONCE = 'It works once, for 15 minutes.';

export function BotLinkDialog({ link, botName, onOpenChange }: BotLinkDialogProps) {
  const meta = link && BOT_PLATFORM_META[link.platform];
  const discord = link?.platform === 'discord';

  return (
    <Modal
      open={!!link}
      onOpenChange={onOpenChange}
      title={meta ? `Connect ${meta.label}` : ''}
      description={
        discord
          ? link.isGroup
            ? `Add the bot to your server, then send the code in the ${meta!.groupLabel} you want to connect. ${ONCE}`
            : `Send the code to ${botName ? `@${botName}` : 'the bot'} in a private message. You need to share a server with it. ${ONCE}`
          : `Open the link on this device, or scan the code with your phone. ${ONCE}`
      }
      size="sm"
      footer={
        link?.url && (
          <Button leftIcon={discord ? <ExternalLink /> : <Send />} asChild>
            <a href={link.url} target="_blank" rel="noreferrer">
              {discord ? (link.isGroup ? 'Add the bot to your server' : 'Open the bot') : 'Open Telegram'}
            </a>
          </Button>
        )
      }
    >
      {link &&
        (discord ? (
          <CodeBlock code={`start ${link.code}`} copyLabel="Code" />
        ) : (
          link.url && (
            <div className="flex justify-center">
              <QrCode value={link.url} size={176} title="Telegram link QR code" />
            </div>
          )
        ))}
    </Modal>
  );
}
