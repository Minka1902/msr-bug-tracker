import path from 'node:path';
import { z } from 'zod';

const ENV_FILE = path.resolve(import.meta.dirname, '../../.env');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  APP_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  UPLOAD_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
  SMTP_URL: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  MAIL_FROM: z.string().default('MSR Tracker <no-reply@msr.local>'),
  ENABLE_DEMO_DATA: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  CLIENT_DIST: z.string().optional(),
  DISABLE_RATE_LIMIT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  /* env comes from the host */
}

const env = schema.parse(process.env);
const isTest = env.NODE_ENV === 'test';

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest,
  databaseUrl: isTest && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
  uploadDir: path.resolve(env.UPLOAD_DIR),
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  devMailbox: !env.SMTP_URL && env.NODE_ENV !== 'production',
  rateLimit: env.NODE_ENV === 'production' || !env.DISABLE_RATE_LIMIT,
};
