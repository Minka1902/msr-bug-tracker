import { config } from '../../config';

interface TelegramResult<T> {
  ok: boolean;
  status: number;
  result?: T;
  description?: string;
}

const API = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

let username: Promise<string | null> | null = null;

export const telegramEnabled = () => !!config.TELEGRAM_BOT_TOKEN;

const call = async <T>(method: string, body: unknown): Promise<TelegramResult<T>> => {
  const response = await fetch(`${API}/bot${config.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as Omit<TelegramResult<T>, 'status'>;
  return { ...data, ok: response.ok && !!data.ok, status: response.status };
};

export const setWebhook = () =>
  call<boolean>('setWebhook', {
    url: new URL('/telegram/webhook', config.APP_URL).href,
    secret_token: config.telegramWebhookSecret,
    allowed_updates: ['message'],
  });

export const botUsername = () => {
  username ??= call<{ username: string }>('getMe', {})
    .then((answer) => answer.result?.username ?? null)
    .catch(() => null)
    .then((name) => {
      if (!name) username = null;
      return name;
    });
  return username;
};

export const sendMessage = (chatId: number, text: string) =>
  call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
