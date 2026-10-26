import { Secret, TOTP } from 'otpauth';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool';
import { agentFor, registerUser, resetDb, testApp, type Agent } from './helpers';

beforeEach(resetDb);

const codeAt = (secret: string, offsetSeconds = 0) =>
  new TOTP({ secret: Secret.fromBase32(secret) }).generate({ timestamp: Date.now() + offsetSeconds * 1000 });

const enableFor = async (agent: Agent, password: string) => {
  const { body: setup } = await agent.post('/api/me/2fa/setup').send({ password }).expect(200);
  const { body } = await agent
    .post('/api/me/2fa/enable')
    .send({ code: codeAt(setup.secret) })
    .expect(200);
  return { secret: setup.secret as string, recoveryCodes: body.recoveryCodes as string[] };
};

const login = (agent: Agent, email: string, password: string) =>
  agent.post('/api/auth/login').send({ email, password }).expect(200);

describe('two-factor authentication', () => {
  it('sets up with a QR secret, needs the password and a valid code', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    await agent.post('/api/me/2fa/setup').send({ password: 'wrong-password' }).expect(400);
    const { body: setup } = await agent.post('/api/me/2fa/setup').send({ password }).expect(200);
    expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/MSR%20Tracker:/);
    expect(setup.otpauthUrl).toContain(encodeURIComponent(email));
    await agent.post('/api/me/2fa/enable').send({ code: '000000' }).expect(400);
    const { body } = await agent
      .post('/api/me/2fa/enable')
      .send({ code: codeAt(setup.secret) })
      .expect(200);
    expect(body.recoveryCodes).toHaveLength(10);
    expect(body.recoveryCodes[0]).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(body.user.twoFactorEnabled).toBe(true);
    await agent.post('/api/me/2fa/setup').send({ password }).expect(409);
    const { rows } = await pool.query('SELECT totp_secret FROM users WHERE email = $1', [email]);
    expect(rows[0].totp_secret).toMatch(/^v1\./);
    expect(rows[0].totp_secret).not.toContain(setup.secret);
  });

  it('asks for a code after the password and rejects a reused code', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    const { secret } = await enableFor(agent, password);
    const fresh = agentFor();
    const { body } = await login(fresh, email, password);
    expect(body).toEqual({ twoFactorRequired: true, ticket: expect.any(String) });
    await fresh.get('/api/auth/me').expect(401);
    await fresh
      .post('/api/auth/login/2fa')
      .send({ ticket: body.ticket, code: codeAt(secret) })
      .expect(401);
    const { body: done } = await fresh
      .post('/api/auth/login/2fa')
      .send({ ticket: body.ticket, code: codeAt(secret, 30) })
      .expect(200);
    expect(done.user).toMatchObject({ email, twoFactorEnabled: true });
    await fresh.get('/api/auth/me').expect(200);
    await agentFor()
      .post('/api/auth/login/2fa')
      .send({ ticket: body.ticket, code: codeAt(secret, 30) })
      .expect(400);
  });

  it('accepts each recovery code once, in any case or spacing', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    const { recoveryCodes } = await enableFor(agent, password);
    const first = agentFor();
    const { body } = await login(first, email, password);
    const typed = ` ${recoveryCodes[0]!.toUpperCase().replace('-', ' ')} `;
    await first.post('/api/auth/login/2fa').send({ ticket: body.ticket, code: typed }).expect(200);
    const second = agentFor();
    const { body: again } = await login(second, email, password);
    await second
      .post('/api/auth/login/2fa')
      .send({ ticket: again.ticket, code: recoveryCodes[0] })
      .expect(401);
    expect((await agent.get('/api/me/2fa').expect(200)).body).toEqual({
      enabled: true,
      recoveryCodesLeft: 9,
    });
  });

  it('expires the sign-in ticket', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    const { recoveryCodes } = await enableFor(agent, password);
    const { body } = await login(agentFor(), email, password);
    await pool.query(
      "UPDATE auth_tokens SET expires_at = now() - interval '1 second' WHERE type = 'two_factor'",
    );
    await agentFor()
      .post('/api/auth/login/2fa')
      .send({ ticket: body.ticket, code: recoveryCodes[0] })
      .expect(400);
  });

  it('turns off with the password and a code, and regenerates recovery codes', async () => {
    const agent = agentFor();
    const { email, password } = await registerUser(agent);
    const { recoveryCodes } = await enableFor(agent, password);
    const { body: fresh } = await agent
      .post('/api/me/2fa/recovery-codes')
      .send({ code: recoveryCodes[0] })
      .expect(200);
    expect(fresh.recoveryCodes).toHaveLength(10);
    await agent.post('/api/me/2fa/disable').send({ password, code: recoveryCodes[1] }).expect(400);
    await agent
      .post('/api/me/2fa/disable')
      .send({ password: 'nope-nope', code: fresh.recoveryCodes[0] })
      .expect(400);
    const { body } = await agent
      .post('/api/me/2fa/disable')
      .send({ password, code: fresh.recoveryCodes[0] })
      .expect(200);
    expect(body.user.twoFactorEnabled).toBe(false);
    expect((await login(agentFor(), email, password)).body.user.email).toBe(email);
  });

  it('rate limits code guesses per sign-in', async () => {
    const app = testApp({ rateLimit: true });
    const agent = agentFor(app);
    const { email, password } = await registerUser(agent);
    await enableFor(agent, password);
    const { body } = await login(agentFor(app), email, password);
    for (let attempt = 0; attempt < 10; attempt += 1)
      await agentFor(app)
        .post('/api/auth/login/2fa')
        .send({ ticket: body.ticket, code: '123456' })
        .expect(401);
    await agentFor(app).post('/api/auth/login/2fa').send({ ticket: body.ticket, code: '123456' }).expect(429);
  });
});
