import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { mailbox } from '../src/lib/mailer';
import { agentFor, lastLink, registerUser, resetDb, testApp } from './helpers';

beforeEach(resetDb);

describe('registration', () => {
  it('creates an account, signs in and sends a verification email', async () => {
    const agent = agentFor();
    const { user, email } = await registerUser(agent, { email: 'New.User@Test.dev' });
    expect(user.email).toBe('new.user@test.dev');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({
      email: 'new.user@test.dev',
      emailVerified: false,
      impersonator: null,
    });
    expect(me.body.user.preferences).toMatchObject({ style: 'aurora', mode: 'system', nav: 'sidebar' });
    expect(lastLink(email.toLowerCase(), '/verify-email')).toBeTruthy();
  });

  it('rejects duplicate emails case-insensitively', async () => {
    const agent = agentFor();
    await registerUser(agent, { email: 'dup@test.dev' });
    await agentFor()
      .post('/api/auth/register')
      .send({ name: 'X', email: 'DUP@test.dev', password: 'password-123' })
      .expect(409);
  });

  it('validates input', async () => {
    const agent = agentFor();
    await agent.post('/api/auth/register').send({ name: '', email: 'bad', password: 'short' }).expect(400);
    await agent
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@test.dev', password: 'x'.repeat(129) })
      .expect(400);
  });

  it('stores only a hash of the session token', async () => {
    const agent = agentFor();
    const response = await agent
      .post('/api/auth/register')
      .send({ name: 'H', email: 'h@test.dev', password: 'password-123' });
    const cookie = String(response.headers['set-cookie']);
    const token = /sid=([^;]+)/.exec(cookie)![1]!;
    expect(cookie).toMatch(/HttpOnly/i);
    const { rows } = await pool.query('SELECT token_hash FROM sessions');
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].token_hash).toString('base64url')).not.toBe(token);
  });
});

describe('login and logout', () => {
  it('signs in with correct credentials and out again', async () => {
    const { email, password } = await registerUser(agentFor());
    const agent = agentFor();
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/login').send({ email: email.toUpperCase(), password }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('uses one generic error for wrong password and unknown email', async () => {
    const { email } = await registerUser(agentFor());
    const wrong = await agentFor()
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknown = await agentFor()
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('rate limits repeated login attempts', async () => {
    const app = testApp({ rateLimit: true });
    const agent = agentFor(app);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await agent
        .post('/api/auth/login')
        .send({ email: 'x@test.dev', password: 'wrong-password' })
        .expect(401);
    }
    await agent.post('/api/auth/login').send({ email: 'x@test.dev', password: 'wrong-password' }).expect(429);
  });

  it('rejects mutating requests from a foreign origin', async () => {
    await agentFor()
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@test.dev', password: 'whatever-1' })
      .expect(403);
  });
});

describe('email verification', () => {
  afterEach(() => {
    config.RESEND_API_KEY = undefined;
    vi.unstubAllGlobals();
  });

  it('verifies with a valid token and accepts the same link again', async () => {
    const agent = agentFor();
    const { email } = await registerUser(agent);
    const token = lastLink(email, '/verify-email');
    await agentFor().post('/api/auth/verify-email').send({ token }).expect(204);
    expect((await agent.get('/api/auth/me')).body.user.emailVerified).toBe(true);
    await agentFor().post('/api/auth/verify-email').send({ token }).expect(204);
  });

  it('sends through Resend when an API key is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    config.RESEND_API_KEY = 're_test';
    const { email } = await registerUser(agentFor());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toMatchObject({ from: config.MAIL_FROM, to: email });
    expect(JSON.parse(init.body).text).toContain('/verify-email?token=');
  });

  it('still registers when the mail provider fails, and reports a failed resend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })));
    config.RESEND_API_KEY = 're_test';
    const agent = agentFor();
    await registerUser(agent);
    const { body } = await agent.post('/api/auth/resend-verification').expect(502);
    expect(body.error).toMatch(/couldn't send/);
  });

  it('rejects expired tokens', async () => {
    const { email } = await registerUser(agentFor());
    await pool.query("UPDATE auth_tokens SET expires_at = now() - interval '1 minute'");
    await agentFor()
      .post('/api/auth/verify-email')
      .send({ token: lastLink(email, '/verify-email') })
      .expect(400);
  });

  it('resends a verification email to signed-in users', async () => {
    const agent = agentFor();
    const { email } = await registerUser(agent);
    const before = mailbox.length;
    await agent.post('/api/auth/resend-verification').expect(204);
    expect(mailbox.length).toBe(before + 1);
    expect(mailbox.at(-1)!.to).toBe(email);
  });
});

describe('password reset', () => {
  it('does not reveal whether an account exists', async () => {
    const before = mailbox.length;
    await agentFor().post('/api/auth/forgot-password').send({ email: 'ghost@test.dev' }).expect(204);
    expect(mailbox.length).toBe(before);
  });

  it('resets the password once and revokes every session', async () => {
    const agent = agentFor();
    const { email } = await registerUser(agent);
    await agentFor().post('/api/auth/forgot-password').send({ email }).expect(204);
    const token = lastLink(email, '/reset-password');
    await agentFor().post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' }).expect(204);
    await agent.get('/api/auth/me').expect(401);
    await agentFor().post('/api/auth/login').send({ email, password: 'brand-new-pass' }).expect(200);
    await agentFor().post('/api/auth/reset-password').send({ token, password: 'another-pass-1' }).expect(400);
  });
});

describe('account settings', () => {
  it('updates name and merges preferences', async () => {
    const agent = agentFor();
    await registerUser(agent);
    await agent
      .patch('/api/me')
      .send({ name: 'Renamed', preferences: { mode: 'dark' } })
      .expect(200);
    const { body } = await agent
      .patch('/api/me')
      .send({ preferences: { style: 'clean', timezone: 'Asia/Jerusalem', hand: 'left' } })
      .expect(200);
    expect(body.user.name).toBe('Renamed');
    expect(body.user.preferences).toEqual({
      style: 'clean',
      mode: 'dark',
      nav: 'sidebar',
      hand: 'left',
      touch: 'standard',
      timezone: 'Asia/Jerusalem',
      aiProvider: null,
    });
    await agent
      .patch('/api/me')
      .send({ preferences: { mode: 'neon' } })
      .expect(400);
    await agent
      .patch('/api/me')
      .send({ preferences: { timezone: 'Mars/Olympus' } })
      .expect(400);
  });

  it('changes password with the current one and keeps only this session', async () => {
    const first = agentFor();
    const { email, password } = await registerUser(first);
    const second = agentFor();
    await second.post('/api/auth/login').send({ email, password }).expect(200);
    await first
      .put('/api/me/password')
      .send({ currentPassword: 'nope-nope-1', newPassword: 'next-password-1' })
      .expect(400);
    await first
      .put('/api/me/password')
      .send({ currentPassword: password, newPassword: 'next-password-1' })
      .expect(204);
    await first.get('/api/auth/me').expect(200);
    await second.get('/api/auth/me').expect(401);
  });

  it('changes email, requires re-verification and voids old verification links', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    const oldToken = lastLink(email, '/verify-email');
    await agent.put('/api/me/email').send({ email: 'moved@test.dev', password: 'wrong-pass-1' }).expect(400);
    await agent.put('/api/me/email').send({ email: 'moved@test.dev', password }).expect(200);
    await agentFor().post('/api/auth/verify-email').send({ token: oldToken }).expect(400);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ email: 'moved@test.dev', emailVerified: false });
    await agentFor()
      .post('/api/auth/verify-email')
      .send({ token: lastLink('moved@test.dev', '/verify-email') })
      .expect(204);
  });

  it('requires a session for account routes', async () => {
    await agentFor().patch('/api/me').send({ name: 'x' }).expect(401);
  });
});
