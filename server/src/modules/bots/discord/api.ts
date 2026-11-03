import { config } from '../../../config';
import type { SendResult } from '../platforms';

interface Application {
  id: string;
  bot: { id: string; username: string };
}

const API = 'https://discord.com/api/v10';
const TIMEOUT_MS = 10_000;
const SUPPRESS_EMBEDS = 1 << 2;
const PERMISSIONS = (1 << 10) | (1 << 11) | (1 << 16);
const GONE = new Set([403, 404]);

let app: Promise<Application | null> | null = null;

export const discordEnabled = () => !!config.DISCORD_BOT_TOKEN;

const call = (method: 'GET' | 'POST', path: string, body?: unknown) =>
  fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

const json = async <T>(path: string) => {
  const response = await call('GET', path);
  return response.ok ? ((await response.json()) as T) : null;
};

export const application = () => {
  app ??= json<Application>('/oauth2/applications/@me')
    .catch(() => null)
    .then((found) => {
      if (!found) app = null;
      return found;
    });
  return app;
};

export const installUrl = (applicationId: string) =>
  `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot&permissions=${PERMISSIONS}`;

export const channelTitle = async (channelId: string, guildId: string) => {
  const [channel, guild] = await Promise.all([
    json<{ name?: string }>(`/channels/${channelId}`).catch(() => null),
    json<{ name?: string }>(`/guilds/${guildId}`).catch(() => null),
  ]);
  return [guild?.name, channel?.name && `#${channel.name}`].filter(Boolean).join(' ');
};

export const sendDiscord = async (channelId: string, text: string): Promise<SendResult> => {
  const response = await call('POST', `/channels/${channelId}/messages`, {
    content: text,
    allowed_mentions: { parse: [] },
    flags: SUPPRESS_EMBEDS,
  });
  if (response.ok) return { ok: true };
  const data = (await response.json().catch(() => ({}))) as { message?: string; retry_after?: number };
  return {
    ok: false,
    gone: GONE.has(response.status),
    retryAfter: response.status === 429 ? (data.retry_after ?? 1) : undefined,
    error: data.message ?? `HTTP ${response.status}`,
  };
};
