import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db/pool';
import { agentFor, registerUser, resetDb } from './helpers';

beforeEach(resetDb);
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('AI API keys', () => {
  it('tests a key with the provider, stores it sealed and only returns the last 4 characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const agent = agentFor();
    await registerUser(agent);
    const { body } = await agent
      .put('/api/me/ai-keys/openai')
      .send({ key: 'sk-proj-abcdefgh1234' })
      .expect(200);
    expect(body.keys).toEqual([{ provider: 'openai', last4: '1234', verifiedAt: expect.any(String) }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.headers.Authorization).toBe('Bearer sk-proj-abcdefgh1234');
    const { rows } = await pool.query('SELECT key_sealed FROM user_api_keys');
    expect(rows[0].key_sealed).toMatch(/^v1\./);
    expect(rows[0].key_sealed).not.toContain('abcdefgh');
    expect(JSON.stringify((await agent.get('/api/me/ai-keys').expect(200)).body)).not.toContain('abcdefgh');
  });

  it('rejects keys the provider refuses and reports when it is unreachable', async () => {
    const agent = agentFor();
    await registerUser(agent);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: { status: 'INVALID_ARGUMENT' } })));
    const rejected = await agent
      .put('/api/me/ai-keys/google')
      .send({ key: 'AIza-not-a-real-key' })
      .expect(400);
    expect(rejected.body.error).toMatch(/Google rejected this Gemini key/);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    await agent.put('/api/me/ai-keys/xai').send({ key: 'xai-1234567890' }).expect(502);
    expect((await agent.get('/api/me/ai-keys')).body.keys).toEqual([]);
  });

  it('checks Claude keys through the Anthropic SDK', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(401, { type: 'error', error: { type: 'authentication_error', message: 'bad' } }),
      )
      .mockResolvedValueOnce(json(200, { data: [], has_more: false, first_id: null, last_id: null }));
    vi.stubGlobal('fetch', fetchMock);
    const agent = agentFor();
    await registerUser(agent);
    await agent.put('/api/me/ai-keys/anthropic').send({ key: 'sk-ant-wrong-key-0000' }).expect(400);
    await agent.put('/api/me/ai-keys/anthropic').send({ key: 'sk-ant-right-key-9999' }).expect(200);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('api.anthropic.com/v1/models');
  });

  it('removes a key, refuses unknown providers and sets the default provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { data: [] })));
    const agent = agentFor();
    await registerUser(agent);
    await agent.put('/api/me/ai-keys/xai').send({ key: 'xai-1234567890' }).expect(200);
    expect((await agent.delete('/api/me/ai-keys/xai').expect(200)).body.keys).toEqual([]);
    await agent.put('/api/me/ai-keys/mistral').send({ key: 'mistral-1234567890' }).expect(400);
    const { body } = await agent
      .patch('/api/me')
      .send({ preferences: { aiProvider: 'anthropic' } })
      .expect(200);
    expect(body.user.preferences.aiProvider).toBe('anthropic');
  });
});
