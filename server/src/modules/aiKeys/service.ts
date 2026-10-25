import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from '@msr/shared/enums';
import { query } from '../../db/pool';
import { sealSecret } from '../../lib/secretBox';

export type KeyCheck = 'valid' | 'invalid' | 'unreachable';

const CHECK_TIMEOUT_MS = 10_000;
const REJECTED_STATUSES = new Set([400, 401, 403]);

const HTTP_CHECKS: Record<Exclude<AiProvider, 'anthropic'>, { url: string; headers: (key: string) => Record<string, string> }> =
  {
    openai: { url: 'https://api.openai.com/v1/models', headers: (key) => ({ Authorization: `Bearer ${key}` }) },
    google: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      headers: (key) => ({ 'x-goog-api-key': key }),
    },
    xai: { url: 'https://api.x.ai/v1/models', headers: (key) => ({ Authorization: `Bearer ${key}` }) },
  };

const LIST_KEYS = `
  SELECT provider, last4, verified_at FROM user_api_keys WHERE user_id = $1 ORDER BY provider`;
const UPSERT_KEY = `
  INSERT INTO user_api_keys (user_id, provider, key_sealed, last4) VALUES ($1, $2, $3, $4)
  ON CONFLICT (user_id, provider) DO UPDATE SET key_sealed = EXCLUDED.key_sealed, last4 = EXCLUDED.last4, verified_at = now()`;
const DELETE_KEY = 'DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2';

const checkAnthropic = async (apiKey: string): Promise<KeyCheck> => {
  try {
    await new Anthropic({ apiKey, timeout: CHECK_TIMEOUT_MS, maxRetries: 0 }).models.list({ limit: 1 });
    return 'valid';
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
      return 'invalid';
    return 'unreachable';
  }
};

const checkOverHttp = async (provider: keyof typeof HTTP_CHECKS, key: string): Promise<KeyCheck> => {
  const check = HTTP_CHECKS[provider];
  try {
    const response = await fetch(check.url, {
      headers: check.headers(key),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (response.ok) return 'valid';
    return REJECTED_STATUSES.has(response.status) ? 'invalid' : 'unreachable';
  } catch {
    return 'unreachable';
  }
};

export const checkApiKey = (provider: AiProvider, key: string) =>
  provider === 'anthropic' ? checkAnthropic(key) : checkOverHttp(provider, key);

export const listApiKeys = (userId: string) =>
  query<{ provider: AiProvider; last4: string; verified_at: Date }>(LIST_KEYS, [userId]).then((rows) =>
    rows.map((row) => ({ provider: row.provider, last4: row.last4, verifiedAt: row.verified_at.toISOString() })),
  );

export const saveApiKey = (userId: string, provider: AiProvider, key: string) =>
  query(UPSERT_KEY, [userId, provider, sealSecret(key), key.slice(-4)]);

export const deleteApiKey = (userId: string, provider: AiProvider) => query(DELETE_KEY, [userId, provider]);
