import type { CurrentUser, UserPreferences, UserRef } from '@msr/shared/types';
import type { PreferencesInput } from '@msr/shared/schemas/auth';
import { query, queryOne, type Db } from '../../db/pool';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_key: string | null;
  email_verified_at: Date | null;
  totp_enabled_at: Date | null;
  preferences: Partial<UserPreferences>;
  created_at: Date;
  demo_owner_id: string | null;
  agent_owner_id: string | null;
}

const USER_COLUMNS =
  'id, email, name, avatar_key, email_verified_at, totp_enabled_at, preferences, created_at, demo_owner_id, agent_owner_id';

const FIND_BY_ID = `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`;
const FIND_BY_EMAIL = `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`;
const INSERT_USER = `INSERT INTO users (name, email, password_hash, preferences) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`;
const UPDATE_PROFILE = `
  UPDATE users SET name = COALESCE($2, name), preferences = preferences || $3::jsonb, updated_at = now()
  WHERE id = $1 RETURNING ${USER_COLUMNS}`;
const SET_PASSWORD = 'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1';
const SET_EMAIL = `UPDATE users SET email = $2, email_verified_at = NULL, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`;
const MARK_VERIFIED = 'UPDATE users SET email_verified_at = now() WHERE id = $1 AND email = $2 RETURNING id';
const PASSWORD_HASH = 'SELECT password_hash FROM users WHERE id = $1';
const SET_AVATAR = `
  WITH old AS (SELECT avatar_key FROM users WHERE id = $1 FOR UPDATE)
  UPDATE users SET avatar_key = $2, updated_at = now() FROM old WHERE users.id = $1 RETURNING old.avatar_key AS previous`;

export const DEFAULT_PREFERENCES: UserPreferences = {
  style: 'aurora',
  mode: 'system',
  nav: 'sidebar',
  hand: 'right',
  touch: 'standard',
  timezone: 'UTC',
  aiProvider: null,
};

export const avatarUrl = (id: string, avatarKey: string | null) =>
  avatarKey ? `/api/users/${id}/avatar?v=${avatarKey.slice(0, 8)}` : null;

export const toUserRef = (row: { id: string; name: string; avatar_key: string | null }): UserRef => ({
  id: row.id,
  name: row.name,
  avatarUrl: avatarUrl(row.id, row.avatar_key),
});

export const toCurrentUser = (row: UserRow, impersonator: UserRef | null = null): CurrentUser => ({
  ...toUserRef(row),
  email: row.email,
  emailVerified: row.email_verified_at !== null,
  twoFactorEnabled: row.totp_enabled_at !== null,
  preferences: { ...DEFAULT_PREFERENCES, ...row.preferences },
  createdAt: row.created_at.toISOString(),
  impersonator,
});

export const findUserById = (id: string, db?: Db) => queryOne<UserRow>(FIND_BY_ID, [id], db);

export const findUserByEmail = (email: string, db?: Db) =>
  queryOne<UserRow & { password_hash: string | null }>(FIND_BY_EMAIL, [email], db);

export const insertUser = (
  name: string,
  email: string,
  passwordHash: string | null,
  preferences: Partial<UserPreferences>,
  db?: Db,
) => queryOne<UserRow>(INSERT_USER, [name, email, passwordHash, preferences], db).then((row) => row!);

export const updateProfile = (id: string, name: string | undefined, preferences: PreferencesInput = {}) =>
  queryOne<UserRow>(UPDATE_PROFILE, [id, name ?? null, preferences]).then((row) => row!);

export const getPasswordHash = (id: string) =>
  queryOne<{ password_hash: string | null }>(PASSWORD_HASH, [id]).then((row) => row?.password_hash);

export const setPassword = (id: string, passwordHash: string, db?: Db) =>
  query(SET_PASSWORD, [id, passwordHash], db);

export const setEmail = (id: string, email: string, db?: Db) =>
  queryOne<UserRow>(SET_EMAIL, [id, email], db).then((row) => row!);

export const markEmailVerified = (id: string, email: string, db?: Db) =>
  query(MARK_VERIFIED, [id, email], db).then((rows) => rows.length > 0);

export const setAvatarKey = (id: string, avatarKey: string | null) =>
  queryOne<{ previous: string | null }>(SET_AVATAR, [id, avatarKey]).then((row) => row?.previous ?? null);
