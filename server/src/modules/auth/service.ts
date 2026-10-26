import type { Request } from 'express';
import { prepared, query, queryOne, type Db } from '../../db/pool';
import { appLink, sendMail } from '../../lib/mailer';
import { SESSION_DAYS } from '../../lib/sessionCookie';
import { hashToken, randomToken } from '../../lib/tokens';

type TokenType = 'verify_email' | 'reset_password' | 'two_factor';

const TOKEN_TTL_MINUTES: Record<TokenType, number> = {
  verify_email: 60 * 48,
  reset_password: 60,
  two_factor: 10,
};

const INSERT_SESSION = `
  INSERT INTO sessions (token_hash, user_id, impersonator_id, expires_at, user_agent, ip)
  VALUES ($1, $2, $3, now() + make_interval(days => $4), $5, $6) RETURNING id`;
const DELETE_SESSION = 'DELETE FROM sessions WHERE id = $1';
const DELETE_USER_SESSIONS =
  'DELETE FROM sessions WHERE (user_id = $1 OR impersonator_id = $1) AND id IS DISTINCT FROM $2';
const INSERT_TOKEN = `
  INSERT INTO auth_tokens (user_id, type, token_hash, email, expires_at)
  VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`;
const CONSUME_TOKEN = `
  UPDATE auth_tokens SET used_at = now()
  WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > now()
  RETURNING user_id, email`;
const PEEK_TOKEN = `
  SELECT user_id, email FROM auth_tokens
  WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > now()`;
const VERIFIED_TOKEN = `
  SELECT 1 FROM auth_tokens t JOIN users u ON u.id = t.user_id
  WHERE t.token_hash = $1 AND t.type = 'verify_email' AND t.used_at IS NOT NULL
    AND u.email = t.email AND u.email_verified_at IS NOT NULL`;
const VOID_TOKENS =
  'UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND type = $2 AND used_at IS NULL';

export const createSession = async (
  req: Request,
  userId: string,
  impersonatorId: string | null = null,
  db?: Db,
) => {
  const token = randomToken();
  await query(
    INSERT_SESSION,
    [
      hashToken(token),
      userId,
      impersonatorId,
      SESSION_DAYS,
      req.get('user-agent')?.slice(0, 300) ?? null,
      req.ip ?? null,
    ],
    db,
  );
  return token;
};

export const deleteSession = (sessionId: string) => prepared('delete-session', DELETE_SESSION, [sessionId]);

export const deleteUserSessions = (userId: string, exceptSessionId: string | null = null, db?: Db) =>
  query(DELETE_USER_SESSIONS, [userId, exceptSessionId], db);

export const issueToken = async (userId: string, type: TokenType, email: string, db?: Db) => {
  const token = randomToken();
  await query(INSERT_TOKEN, [userId, type, hashToken(token), email, TOKEN_TTL_MINUTES[type]], db);
  return token;
};

export const consumeToken = (token: string, type: TokenType, db?: Db) =>
  queryOne<{ user_id: string; email: string }>(CONSUME_TOKEN, [hashToken(token), type], db);

export const peekToken = (token: string, type: TokenType) =>
  queryOne<{ user_id: string; email: string }>(PEEK_TOKEN, [hashToken(token), type]);

export const isVerifiedToken = async (token: string) =>
  !!(await queryOne(VERIFIED_TOKEN, [hashToken(token)]));

export const voidTokens = (userId: string, type: TokenType, db?: Db) =>
  query(VOID_TOKENS, [userId, type], db);

export const sendVerificationEmail = async (user: { id: string; email: string; name: string }) => {
  await voidTokens(user.id, 'verify_email');
  const token = await issueToken(user.id, 'verify_email', user.email);
  await sendMail(
    user.email,
    'Verify your email · MSR Tracker',
    `Hi ${user.name},\n\nConfirm your email address to secure your account:\n${appLink('/verify-email', token)}\n\nThis link expires in 48 hours.`,
  );
};

export const sendPasswordResetEmail = async (user: { id: string; email: string; name: string }) => {
  await voidTokens(user.id, 'reset_password');
  const token = await issueToken(user.id, 'reset_password', user.email);
  await sendMail(
    user.email,
    'Reset your password · MSR Tracker',
    `Hi ${user.name},\n\nReset your password with this link:\n${appLink('/reset-password', token)}\n\nIt expires in 1 hour. If you didn't ask for this, you can ignore this email.`,
  );
};
