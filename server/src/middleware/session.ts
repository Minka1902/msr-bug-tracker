import type { RequestHandler } from 'express';
import type { UserRef } from '@msr/shared/types';
import { prepared, query } from '../db/pool';
import { unauthorized } from '../lib/httpError';
import { SESSION_COOKIE, SESSION_DAYS, setSessionCookie } from '../lib/sessionCookie';
import { hashToken } from '../lib/tokens';
import { avatarUrl, type UserRow } from '../modules/users/service';

export interface SessionUser extends UserRow {
  impersonator: UserRef | null;
}

interface SessionRow extends UserRow {
  session_id: string;
  expires_at: Date;
  impersonator_id: string | null;
  impersonator_name: string | null;
  impersonator_avatar_key: string | null;
}

const REFRESH_AFTER_MS = 86_400_000;

const LOAD_SESSION = `
  SELECT s.id AS session_id, s.expires_at, s.impersonator_id,
         u.id, u.email, u.name, u.avatar_key, u.email_verified_at, u.totp_enabled_at, u.preferences, u.created_at,
         u.demo_owner_id,
         i.name AS impersonator_name, i.avatar_key AS impersonator_avatar_key
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN users i ON i.id = s.impersonator_id
  WHERE s.token_hash = $1 AND s.expires_at > now()`;
const EXTEND_SESSION = 'UPDATE sessions SET expires_at = now() + make_interval(days => $2) WHERE id = $1';

export const loadSession: RequestHandler = async (req, res, next) => {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  const [row] = await prepared<SessionRow>('load-session', LOAD_SESSION, [hashToken(token)]);
  if (!row) return next();

  const { session_id, expires_at, impersonator_id, impersonator_name, impersonator_avatar_key, ...user } =
    row;
  req.sessionId = session_id;
  req.user = {
    ...user,
    impersonator: impersonator_id
      ? {
          id: impersonator_id,
          name: impersonator_name!,
          avatarUrl: avatarUrl(impersonator_id, impersonator_avatar_key),
        }
      : null,
  };

  if (expires_at.getTime() - Date.now() < SESSION_DAYS * 86_400_000 - REFRESH_AFTER_MS) {
    await query(EXTEND_SESSION, [session_id, SESSION_DAYS]);
    setSessionCookie(res, token);
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  next();
};
