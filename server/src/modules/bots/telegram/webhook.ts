import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../../../config';
import { handleMessage } from '../handlers';
import { migrateChat } from '../service';

interface TelegramMessage {
  text?: string;
  migrate_to_chat_id?: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; first_name?: string };
}

const GROUP_TYPES = new Set(['group', 'supergroup']);

const validSecret = (header: string | undefined) => {
  const expected = Buffer.from(config.telegramWebhookSecret);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const reply = async (message: TelegramMessage) => {
  const chatId = String(message.chat.id);
  if (message.migrate_to_chat_id) {
    await migrateChat({ platform: 'telegram', chatId }, String(message.migrate_to_chat_id));
    return null;
  }
  if (!message.text || !message.from) return null;
  return handleMessage({
    platform: 'telegram',
    chatId,
    isGroup: GROUP_TYPES.has(message.chat.type),
    senderId: String(message.from.id),
    text: message.text,
    title: async () => message.chat.title ?? message.chat.first_name ?? '',
  });
};

export const createTelegramWebhookRouter = () => {
  const router = Router();

  router.post('/telegram/webhook', async (req, res) => {
    if (!validSecret(req.get('x-telegram-bot-api-secret-token'))) {
      res.status(401).end();
      return;
    }
    const message = (req.body as { message?: TelegramMessage }).message;
    const text = message && (await reply(message));
    if (!text) {
      res.status(200).end();
      return;
    }
    res.json({
      method: 'sendMessage',
      chat_id: message.chat.id,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  return router;
};
