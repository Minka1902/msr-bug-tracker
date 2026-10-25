import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, isNetworkError } from '../api';

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns a failed fetch into a network ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await api('/auth/me').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(isNetworkError(error)).toBe(true);
    expect((error as ApiError).message).toMatch(/offline/i);
  });

  it('rethrows aborts untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(api('/search')).rejects.toBe(abort);
  });

  it('keeps http errors as non-network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Nope' }), { status: 403 })),
    );
    const error = await api('/projects/WEB').catch((caught: unknown) => caught);
    expect(isNetworkError(error)).toBe(false);
    expect((error as ApiError).status).toBe(403);
  });
});
