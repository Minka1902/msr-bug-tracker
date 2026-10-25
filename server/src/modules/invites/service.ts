import type { CreatedInvite, InvitePreview, InviteSummary } from '@msr/shared/types';
import { query, queryOne, transaction } from '../../db/pool';
import { config } from '../../config';
import { sendMail } from '../../lib/mailer';
import { hashToken, randomToken } from '../../lib/tokens';

interface InviteRow {
  id: string;
  email: string | null;
  project_name: string | null;
  role_name: string | null;
  inviter_name: string;
  uses: number;
  max_uses: number | null;
  expires_at: Date;
  created_at: Date;
}

interface NewInvite {
  inviterId: string;
  projectId: string | null;
  roleId: string | null;
  email?: string;
  maxUses: number | null;
  expiresInDays: number;
}

const ACTIVE =
  'i.revoked_at IS NULL AND i.expires_at > now() AND (i.max_uses IS NULL OR i.uses < i.max_uses)';

const INSERT_INVITE = `
  INSERT INTO invites (token_hash, inviter_id, project_id, role_id, email, max_uses, expires_at)
  VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7)) RETURNING id`;
const INVITE_SELECT = `
  SELECT i.id, i.email, p.name AS project_name, r.name AS role_name, u.name AS inviter_name, i.uses, i.max_uses,
         i.expires_at, i.created_at
  FROM invites i
  JOIN users u ON u.id = i.inviter_id
  LEFT JOIN projects p ON p.id = i.project_id
  LEFT JOIN project_roles r ON r.id = i.role_id`;
const GET_INVITE = `${INVITE_SELECT} WHERE i.id = $1`;
const LIST_PROJECT_INVITES = `${INVITE_SELECT} WHERE i.project_id = $1 AND ${ACTIVE} ORDER BY i.created_at DESC`;
const REVOKE_PROJECT_INVITE =
  'UPDATE invites SET revoked_at = now() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL RETURNING id';
const DELETE_INVITE = 'DELETE FROM invites WHERE id = $1';
const PREVIEW = `
  SELECT u.name AS inviter_name, i.email, i.expires_at, r.name AS role_name,
         p.key, p.name AS project_name, p.color, p.icon
  FROM invites i
  JOIN users u ON u.id = i.inviter_id
  LEFT JOIN projects p ON p.id = i.project_id
  LEFT JOIN project_roles r ON r.id = i.role_id
  WHERE i.token_hash = $1 AND ${ACTIVE}`;
const LOCK_INVITE = `
  SELECT i.id, i.project_id, i.role_id, i.email, p.key
  FROM invites i LEFT JOIN projects p ON p.id = i.project_id
  WHERE i.token_hash = $1 AND ${ACTIVE}
  FOR UPDATE OF i`;
const JOIN_PROJECT = `
  INSERT INTO project_members (project_id, user_id, role_id) VALUES ($1, $2, $3)
  ON CONFLICT DO NOTHING RETURNING user_id`;
const USE_INVITE = 'UPDATE invites SET uses = uses + 1 WHERE id = $1';
const VERIFY_INVITED_EMAIL = `
  UPDATE users SET email_verified_at = now() WHERE id = $1 AND email = $2 AND email_verified_at IS NULL`;

const inviteUrl = (token: string) => `${config.APP_URL}/invite/${token}`;

const toSummary = (row: InviteRow): InviteSummary => ({
  id: row.id,
  email: row.email,
  projectName: row.project_name,
  roleName: row.role_name,
  inviterName: row.inviter_name,
  uses: row.uses,
  maxUses: row.max_uses,
  expiresAt: row.expires_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

export const createInvite = async (input: NewInvite): Promise<CreatedInvite> => {
  const token = randomToken();
  const created = await queryOne<{ id: string }>(INSERT_INVITE, [
    hashToken(token),
    input.inviterId,
    input.projectId,
    input.roleId,
    input.email ?? null,
    input.email ? 1 : input.maxUses,
    input.expiresInDays,
  ]);
  const row = await queryOne<InviteRow>(GET_INVITE, [created!.id]);
  return { ...toSummary(row!), url: inviteUrl(token) };
};

export const deleteInvite = (id: string) => query(DELETE_INVITE, [id]);

export const sendInviteEmail = (invite: CreatedInvite) =>
  sendMail(
    invite.email!,
    `${invite.inviterName} invited you to ${invite.projectName ?? 'MSR Tracker'}`,
    `Hi,\n\n${invite.inviterName} invited you to ${invite.projectName ? `join "${invite.projectName}" on MSR Tracker` : 'MSR Tracker'}.\n\nAccept the invite:\n${invite.url}\n\nThe link expires on ${new Date(invite.expiresAt).toUTCString().slice(0, 16)}.`,
  );

export const listProjectInvites = (projectId: string) =>
  query<InviteRow>(LIST_PROJECT_INVITES, [projectId]).then((rows) => rows.map(toSummary));

export const revokeProjectInvite = async (id: string, projectId: string) =>
  !!(await queryOne(REVOKE_PROJECT_INVITE, [id, projectId]));

export const previewInvite = async (token: string): Promise<InvitePreview | null> => {
  const row = await queryOne<{
    inviter_name: string;
    email: string | null;
    expires_at: Date;
    role_name: string | null;
    key: string | null;
    project_name: string | null;
    color: string | null;
    icon: string | null;
  }>(PREVIEW, [hashToken(token)]);
  if (!row) return null;
  return {
    inviterName: row.inviter_name,
    email: row.email,
    roleName: row.role_name,
    expiresAt: row.expires_at.toISOString(),
    project: row.key ? { key: row.key, name: row.project_name!, color: row.color!, icon: row.icon! } : null,
  };
};

export const acceptInvite = (token: string, user: { id: string; email: string }) =>
  transaction(async (db) => {
    const invite = await queryOne<{
      id: string;
      project_id: string | null;
      role_id: string | null;
      email: string | null;
      key: string | null;
    }>(LOCK_INVITE, [hashToken(token)], db);
    if (!invite) return null;
    const joined = invite.project_id
      ? !!(await queryOne(JOIN_PROJECT, [invite.project_id, user.id, invite.role_id], db))
      : true;
    if (joined) await query(USE_INVITE, [invite.id], db);
    if (invite.email) await query(VERIFY_INVITED_EMAIL, [user.id, invite.email], db);
    return { projectKey: invite.key, joined };
  });
