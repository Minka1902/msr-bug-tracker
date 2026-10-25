import { randomInt } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { query, queryOne, transaction, type Db } from '../../db/pool';
import { conflict } from '../../lib/httpError';
import { openSecret, sealSecret } from '../../lib/secretBox';
import { hashToken } from '../../lib/tokens';

const ISSUER = 'MSR Tracker';
const PERIOD_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const TOTP_CODE = /^\d{6}$/;

const USER_TOTP = 'SELECT email, totp_secret, totp_enabled_at FROM users WHERE id = $1';
const SET_PENDING_SECRET = `
  UPDATE users SET totp_secret = $2, totp_last_step = NULL WHERE id = $1 AND totp_enabled_at IS NULL RETURNING id`;
const CLAIM_STEP = `
  UPDATE users SET totp_last_step = $2
  WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING id`;
const ENABLE = 'UPDATE users SET totp_enabled_at = now(), updated_at = now() WHERE id = $1';
const DISABLE = `
  UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL, updated_at = now() WHERE id = $1`;
const DELETE_CODES = 'DELETE FROM recovery_codes WHERE user_id = $1';
const INSERT_CODES = 'INSERT INTO recovery_codes (user_id, code_hash) SELECT $1, unnest($2::bytea[])';
const USE_CODE = `
  UPDATE recovery_codes SET used_at = now()
  WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING user_id`;
const CODES_LEFT = 'SELECT count(*)::int AS left FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL';

const totpFor = (secret: string, label: string) =>
  new TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secret),
  });

const randomChars = (count: number) =>
  Array.from({ length: count }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');

const recoveryCode = () => `${randomChars(5)}-${randomChars(5)}`;

const replaceRecoveryCodes = async (userId: string, db: Db) => {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, recoveryCode);
  await query(DELETE_CODES, [userId], db);
  await query(INSERT_CODES, [userId, codes.map((code) => hashToken(code.replace('-', '')))], db);
  return codes;
};

const verifyTotp = async (userId: string, code: string) => {
  const user = await queryOne<{ email: string; totp_secret: string | null }>(USER_TOTP, [userId]);
  if (!user?.totp_secret) return false;
  const delta = totpFor(openSecret(user.totp_secret), user.email).validate({ token: code, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + delta;
  return !!(await queryOne(CLAIM_STEP, [userId, step]));
};

export const verifySecondFactor = async (userId: string, code: string) =>
  TOTP_CODE.test(code) ? verifyTotp(userId, code) : !!(await queryOne(USE_CODE, [userId, hashToken(code)]));

export const startTwoFactorSetup = async (userId: string) => {
  const user = await queryOne<{ email: string; totp_enabled_at: Date | null }>(USER_TOTP, [userId]);
  if (user!.totp_enabled_at) throw conflict('Two-factor authentication is already on');
  const secret = new Secret({ size: 20 }).base32;
  await query(SET_PENDING_SECRET, [userId, sealSecret(secret)]);
  return { secret, otpauthUrl: totpFor(secret, user!.email).toString() };
};

export const enableTwoFactor = async (userId: string, code: string) => {
  if (!TOTP_CODE.test(code) || !(await verifyTotp(userId, code))) return null;
  return transaction(async (db) => {
    await query(ENABLE, [userId], db);
    return replaceRecoveryCodes(userId, db);
  });
};

export const regenerateRecoveryCodes = (userId: string) =>
  transaction((db) => replaceRecoveryCodes(userId, db));

export const disableTwoFactor = (userId: string) =>
  transaction(async (db) => {
    await query(DISABLE, [userId], db);
    await query(DELETE_CODES, [userId], db);
  });

export const recoveryCodesLeft = (userId: string) =>
  queryOne<{ left: number }>(CODES_LEFT, [userId]).then((row) => row!.left);
