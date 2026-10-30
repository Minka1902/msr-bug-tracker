import { describe, expect, it } from 'vitest';
import { envSchema } from '../src/config';

const BASE = { DATABASE_URL: 'postgres://localhost/msr' };

describe('env schema', () => {
  it('uses the Render external URL when APP_URL is not set', () => {
    expect(envSchema.parse({ ...BASE, RENDER_EXTERNAL_URL: 'https://msr.onrender.com' }).APP_URL).toBe(
      'https://msr.onrender.com',
    );
  });

  it('prefers an explicit APP_URL', () => {
    const env = envSchema.parse({
      ...BASE,
      APP_URL: 'https://tracker.example.com',
      RENDER_EXTERNAL_URL: 'https://msr.onrender.com',
    });
    expect(env.APP_URL).toBe('https://tracker.example.com');
  });

  it('falls back to the dev client URL and default sender for blank values', () => {
    const env = envSchema.parse({ ...BASE, MAIL_FROM: '', SMTP_URL: '' });
    expect(env.APP_URL).toBe('http://localhost:5173');
    expect(env.MAIL_FROM).toBe('MSR Tracker <no-reply@msr.local>');
    expect(env.SMTP_URL).toBeUndefined();
  });

  it('requires a 32-byte ENCRYPTION_KEY in production and uses a dev key elsewhere', () => {
    expect(() => envSchema.parse({ ...BASE, NODE_ENV: 'production' })).toThrow(/ENCRYPTION_KEY is required/);
    expect(() => envSchema.parse({ ...BASE, ENCRYPTION_KEY: 'c2hvcnQ=' })).toThrow(/32 random bytes/);
    const key = Buffer.alloc(32, 7).toString('base64');
    expect(envSchema.parse({ ...BASE, NODE_ENV: 'production', ENCRYPTION_KEY: key }).ENCRYPTION_KEY).toBe(
      key,
    );
    expect(Buffer.from(envSchema.parse(BASE).ENCRYPTION_KEY, 'base64')).toHaveLength(32);
  });

  it('needs all four R2 variables or none', () => {
    expect(() => envSchema.parse({ ...BASE, R2_BUCKET: 'files' })).toThrow(/all four R2_/);
    const r2 = { R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET: 'd' };
    expect(envSchema.parse({ ...BASE, ...r2 })).toMatchObject(r2);
    expect(envSchema.parse({ ...BASE, R2_BUCKET: '' }).R2_BUCKET).toBeUndefined();
  });
});
