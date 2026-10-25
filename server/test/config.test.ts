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
});
