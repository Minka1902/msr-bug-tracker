import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { copyIntoStorage } from '../src/lib/storage';
import { agentFor, registerUser, resetDb } from './helpers';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

beforeEach(resetDb);

describe('avatars', () => {
  it('no longer accepts uploads', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await agent.post('/api/me/avatar').attach('avatar', fixture('red.png')).expect(404);
  });

  it('serves and removes an existing profile image', async () => {
    const agent = agentFor();
    const { user } = await registerUser(agent);
    await copyIntoStorage(fixture('red.png'), 'avatars/existing.png');
    await pool.query("UPDATE users SET avatar_key = 'avatars/existing.png' WHERE id = $1", [user.id]);
    const { body } = await agent.get('/api/auth/me').expect(200);
    expect(body.user.avatarUrl).toMatch(new RegExp(`^/api/users/${user.id}/avatar\\?v=`));
    const image = await agent.get(body.user.avatarUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    await agent.delete('/api/me/avatar').expect(200);
    await agent.get(`/api/users/${user.id}/avatar`).expect(404);
  });

  it('requires a session to view avatars', async () => {
    await agentFor().get('/api/users/00000000-0000-0000-0000-000000000000/avatar').expect(401);
  });
});
