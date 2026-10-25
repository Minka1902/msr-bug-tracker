import path from 'node:path';
import { z } from 'zod';

const ENV_FILE = path.resolve(import.meta.dirname, '../../.env');

const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_MAIL_FROM = 'MSR Tracker <no-reply@msr.local>';

const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), type.optional());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    APP_URL: optional(z.url()),
    RENDER_EXTERNAL_URL: optional(z.url()),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().optional(),
    UPLOAD_DIR: z.string().default('./storage'),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
    SMTP_URL: optional(z.string()),
    MAIL_FROM: optional(z.string()),
    ENABLE_DEMO_DATA: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    CLIENT_DIST: z.string().optional(),
    DISABLE_RATE_LIMIT: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .transform(({ RENDER_EXTERNAL_URL, ...env }) => ({
    ...env,
    APP_URL: env.APP_URL ?? RENDER_EXTERNAL_URL ?? DEFAULT_APP_URL,
    MAIL_FROM: env.MAIL_FROM ?? DEFAULT_MAIL_FROM,
  }));

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  /* env comes from the host */
}

const env = envSchema.parse(process.env);
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
