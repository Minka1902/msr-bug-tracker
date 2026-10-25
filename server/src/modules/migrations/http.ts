import { HttpError } from '../../lib/httpError';

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 4;
const RETRYABLE = new Set([429, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryDelay = (response: Response, attempt: number) => {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (retryAfter > 0) return Math.min(retryAfter, 60) * 1000;
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (reset > 0) {
    const resetMs = reset > 1e12 ? reset : reset * 1000;
    return Math.min(Math.max(resetMs - Date.now(), 1000), 60_000);
  }
  return 2 ** attempt * 1000;
};

export const sourceRequest = async <T>(tool: string, url: string, init: RequestInit = {}): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw new HttpError(502, `We couldn't reach ${tool}. Try again in a minute.`);
    }
    if (response.ok) return (await response.json()) as T;
    if (RETRYABLE.has(response.status) && attempt < MAX_RETRIES) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (response.status === 401 || response.status === 403)
      throw new HttpError(400, `${tool} rejected these credentials. Check the token and its access.`);
    if (response.status === 404) throw new HttpError(404, `${tool} couldn't find that. Check the details.`);
    throw new HttpError(502, `${tool} answered with an error (${response.status}). Try again later.`);
  }
};

export const pacer = (minIntervalMs: number) => {
  let next = 0;
  return async () => {
    const wait = next - Date.now();
    next = Math.max(next, Date.now()) + minIntervalMs;
    if (wait > 0) await sleep(wait);
  };
};
