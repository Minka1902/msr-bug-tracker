import { Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { QrCode } from '../../../components/ui/QrCode';

interface TelegramLinkDialogProps {
  url: string | null;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  openLabel?: string;
}

export function TelegramLinkDialog({
  url,
  onOpenChange,
  title = 'Open Telegram',
  description = 'Open the link on this device, or scan the code with your phone. It works once, for 15 minutes.',
  openLabel = 'Open Telegram',
}: TelegramLinkDialogProps) {
  return (
    <Modal
      open={!!url}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        url && (
          <Button leftIcon={<Send />} asChild>
            <a href={url} target="_blank" rel="noreferrer">
              {openLabel}
            </a>
          </Button>
        )
      }
    >
      {url && (
        <div className="flex justify-center">
          <QrCode value={url} size={176} title="Telegram link QR code" />
        </div>
      )}
    </Modal>
  );
}
