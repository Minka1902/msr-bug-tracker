import { createHmac } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';

const ENV_FILE = path.resolve(import.meta.dirname, '../../.env');

const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_MAIL_FROM = 'MSR Tracker <no-reply@msr.local>';
const DEV_ENCRYPTION_KEY = Buffer.from('dev-only-encryption-key-32-bytes').toString('base64');
const KEY_BYTES = 32;

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
    R2_ACCOUNT_ID: optional(z.string()),
    R2_ACCESS_KEY_ID: optional(z.string()),
    R2_SECRET_ACCESS_KEY: optional(z.string()),
    R2_BUCKET: optional(z.string()),
    SMTP_URL: optional(z.string()),
    RESEND_API_KEY: optional(z.string()),
    GOOGLE_CLIENT_ID: optional(z.string()),
    GOOGLE_CLIENT_SECRET: optional(z.string()),
    ENCRYPTION_KEY: optional(
      z
        .string()
        .refine(
          (value) => Buffer.from(value, 'base64').length === KEY_BYTES,
          'ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)',
        ),
    ),
    MAIL_FROM: optional(z.string()),
    TELEGRAM_BOT_TOKEN: optional(z.string()),
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
  .refine((env) => env.ENCRYPTION_KEY || env.NODE_ENV !== 'production', {
    path: ['ENCRYPTION_KEY'],
    message: 'ENCRYPTION_KEY is required in production. Generate one with: openssl rand -base64 32',
  })
  .refine(
    (env) =>
      [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET].filter(Boolean)
        .length %
        4 ===
      0,
    { path: ['R2_BUCKET'], message: 'Set all four R2_* variables to store files on Cloudflare R2, or none' },
  )
  .transform(({ RENDER_EXTERNAL_URL, ...env }) => ({
    ...env,
    APP_URL: env.APP_URL ?? RENDER_EXTERNAL_URL ?? DEFAULT_APP_URL,
    MAIL_FROM: env.MAIL_FROM ?? DEFAULT_MAIL_FROM,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,
  }));

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  /* env comes from the host */
}

const env = envSchema.parse(process.env);
const isTest = env.NODE_ENV === 'test';
const encryptionKey = Buffer.from(env.ENCRYPTION_KEY, 'base64');

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest,
  databaseUrl: isTest && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
  uploadDir: path.resolve(env.UPLOAD_DIR),
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  r2: env.R2_ACCOUNT_ID
    ? {
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`,
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      }
    : null,
  encryptionKey,
  telegramWebhookSecret: createHmac('sha256', encryptionKey).update('telegram-webhook').digest('hex'),
  devMailbox: !env.SMTP_URL && !env.RESEND_API_KEY && env.NODE_ENV !== 'production',
  rateLimit: env.NODE_ENV === 'production' || !env.DISABLE_RATE_LIMIT,
};
