import type { BotPlatform } from '@msr/shared/bots';
import { application, discordEnabled, installUrl, sendDiscord } from './discord/api';
import { discordFormat, telegramFormat, type Formatter } from './format';
import { botUsername, sendTelegram, telegramEnabled } from './telegram/api';

export interface SendResult {
  ok: boolean;
  gone?: boolean;
  movedTo?: string;
  retryAfter?: number;
  error?: string;
}

export interface Platform {
  enabled: () => boolean;
  format: Formatter;
  maxLength: number;
  botName: () => Promise<string | null>;
  linkUrl: (code: string, isGroup: boolean) => Promise<string | null>;
  send: (chatId: string, text: string) => Promise<SendResult>;
}

export const PLATFORMS: Record<BotPlatform, Platform> = {
  telegram: {
    enabled: telegramEnabled,
    format: telegramFormat,
    maxLength: 4096,
    botName: botUsername,
    linkUrl: async (code, isGroup) => {
      const name = await botUsername();
      return name && `https://t.me/${name}?${isGroup ? 'startgroup' : 'start'}=${code}`;
    },
    send: sendTelegram,
  },
  discord: {
    enabled: discordEnabled,
    format: discordFormat,
    maxLength: 2000,
    botName: async () => (await application())?.bot.username ?? null,
    linkUrl: async (_code, isGroup) => {
      const app = await application();
      if (!app) return null;
      return isGroup ? installUrl(app.id) : `https://discord.com/users/${app.bot.id}`;
    },
    send: sendDiscord,
  },
};
