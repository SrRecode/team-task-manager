'use strict';

const { query, withTransaction } = require('../../config/database');
const { normalizeEmail } = require('../../utils/email');
const { conflict } = require('../../utils/errors');

const INVITE_FIELDS = `
  i.id,
  i.team_id,
  i.email,
  i.invited_by,
  i.status,
  i.created_at,
  i.accepted_at,
  u.name AS invited_by_name,
  t.name AS team_name
`;

/**
 * Maps an invite row to the shape the client receives.
 *
 * `delivery` is always 'stub': the assessment does not require a mail server,
 * so the invitation is a record in the database and the response says so
 * explicitly instead of pretending that an email was sent.
 */
function toPublicInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name ?? null,
    email: row.email,
    invitedBy: row.invited_by,
    invitedByName: row.invited_by_name ?? null,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
    delivery: 'stub',
    notificationSent: false,
  };
}

/**
 * Creates a pending invitation for an address.
 *
 * The address does not have to belong to a registered account: that is the
 * point of an invitation. A duplicate pending invitation for the same team is
 * a conflict, so the owner is never told that an invitation was created twice.
 */
async function createInvite({ teamId, email, invitedBy }) {
  const normalizedEmail = normalizeEmail(email);

  const memberResult = await query(
    `SELECT tm.user_id
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1 AND u.email = $2`,
    [teamId, normalizedEmail]
  );

  if (memberResult.rows[0]) {
    throw conflict('That user is already a member of this team');
  }

  const existing = await query(
    `SELECT id FROM team_invites
      WHERE team_id = $1 AND email = $2 AND status = 'pending'`,
    [teamId, normalizedEmail]
  );

  if (existing.rows[0]) {
    throw conflict('That address already has a pending invitation for this team');
  }

  const { rows } = await query(
    `INSERT INTO team_invites (team_id, email, invited_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [teamId, normalizedEmail, invitedBy]
  );

  return findInviteById(rows[0].id);
}

/**
 * Returns a single invitation by its id, or null.
 */
async function findInviteById(inviteId) {
  const { rows } = await query(
    `SELECT ${INVITE_FIELDS}
       FROM team_invites i
       JOIN users u ON u.id = i.invited_by
       JOIN teams t ON t.id = i.team_id
      WHERE i.id = $1`,
    [inviteId]
  );

  return rows[0] ? toPublicInvite(rows[0]) : null;
}

/**
 * Lists the invitations of a team, the pending ones first.
 */
async function listInvites(teamId) {
  const { rows } = await query(
    `SELECT ${INVITE_FIELDS}
       FROM team_invites i
       JOIN users u ON u.id = i.invited_by
       JOIN teams t ON t.id = i.team_id
      WHERE i.team_id = $1
      ORDER BY (i.status = 'pending') DESC, i.created_at DESC`,
    [teamId]
  );

  return rows.map(toPublicInvite);
}

/**
 * Revokes a pending invitation.
 *
 * Only a pending invitation can be revoked: an invitation that was already
 * accepted is a membership and is removed through the member list.
 */
async function revokeInvite(teamId, inviteId) {
  const { rowCount } = await query(
    `UPDATE team_invites
        SET status = 'revoked'
      WHERE id = $1 AND team_id = $2 AND status = 'pending'`,
    [inviteId, teamId]
  );

  return rowCount > 0;
}

/**
 * Turns the pending invitations of an address into real memberships.
 *
 * This is called when the invited person registers an account and when they
 * sign in, so an invitation to somebody who was already registered also
 * becomes a membership. The membership and the status change happen in one
 * transaction, so an invitation is never marked as accepted without the
 * membership existing.
 */
async function acceptPendingInvites({ userId, email }) {
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    const inviteResult = await client.query(
      `SELECT i.id, i.team_id, t.name AS team_name
         FROM team_invites i
         JOIN teams t ON t.id = i.team_id
        WHERE i.email = $1 AND i.status = 'pending'
        ORDER BY i.created_at ASC`,
      [normalizedEmail]
    );

    const accepted = [];

    for (const invite of inviteResult.rows) {
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [invite.team_id, userId]
      );

      await client.query(
        `UPDATE team_invites
            SET status = 'accepted', accepted_at = NOW()
          WHERE id = $1`,
        [invite.id]
      );

      accepted.push({
        id: invite.id,
        teamId: invite.team_id,
        teamName: invite.team_name,
        status: 'accepted',
      });
    }

    return accepted;
  });
}

/**
 * Returns the pending invitations of an address.
 */
async function listPendingInvitesForEmail(email) {
  const { rows } = await query(
    `SELECT ${INVITE_FIELDS}
       FROM team_invites i
       JOIN users u ON u.id = i.invited_by
       JOIN teams t ON t.id = i.team_id
      WHERE i.email = $1 AND i.status = 'pending'
      ORDER BY i.created_at ASC`,
    [normalizeEmail(email)]
  );

  return rows.map(toPublicInvite);
}

module.exports = {
  createInvite,
  findInviteById,
  listInvites,
  revokeInvite,
  acceptPendingInvites,
  listPendingInvitesForEmail,
  toPublicInvite,
};
