import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { agentFor, registerUser, resetDb } from './helpers';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

beforeEach(resetDb);

describe('avatars', () => {
  it('uploads, serves and removes a profile image', async () => {
    const agent = agentFor();
    const { user } = await registerUser(agent);
    const { body } = await agent.post('/api/me/avatar').attach('avatar', fixture('red.png')).expect(200);
    expect(body.user.avatarUrl).toMatch(new RegExp(`^/api/users/${user.id}/avatar\\?v=`));
    const image = await agent.get(body.user.avatarUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    await agent.delete('/api/me/avatar').expect(200);
    await agent.get(`/api/users/${user.id}/avatar`).expect(404);
  });

  it('rejects svg and files that only pretend to be images', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await agent.post('/api/me/avatar').attach('avatar', fixture('evil.svg')).expect(415);
    await agent.post('/api/me/avatar').attach('avatar', fixture('fake.png')).expect(415);
    await agent.post('/api/me/avatar').attach('avatar', fixture('notes.log')).expect(415);
  });

  it('requires a session to view avatars', async () => {
    await agentFor().get('/api/users/00000000-0000-0000-0000-000000000000/avatar').expect(401);
  });
});
