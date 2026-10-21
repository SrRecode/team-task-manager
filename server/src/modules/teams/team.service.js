'use strict';

const { query, withTransaction } = require('../../config/database');
const { normalizeEmail } = require('../../utils/email');
const { conflict, notFound } = require('../../utils/errors');

const TEAM_FIELDS = `
  t.id,
  t.name,
  t.description,
  t.created_by,
  t.created_at,
  t.updated_at,
  tm.role AS current_user_role
`;

/**
 * Maps a team row to the shape the client receives.
 */
function toPublicTeam(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentUserRole: row.current_user_role,
  };
}

/**
 * Maps a membership row to the shape the client receives.
 */
function toPublicMember(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

/**
 * Lists the teams the given user belongs to, with the caller's role on each.
 */
async function listTeamsForUser(userId) {
  const { rows } = await query(
    `SELECT ${TEAM_FIELDS}
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY t.name ASC`,
    [userId]
  );
  return rows.map(toPublicTeam);
}

/**
 * Returns a single team the given user is a member of, or null.
 * The caller's role is included.
 */
async function findTeamForUser(teamId, userId) {
  const { rows } = await query(
    `SELECT ${TEAM_FIELDS}
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
      WHERE t.id = $1 AND tm.user_id = $2`,
    [teamId, userId]
  );
  return rows[0] ? toPublicTeam(rows[0]) : null;
}

/**
 * Returns the role a user holds on a team, or null when they are not a member.
 */
async function getMemberRole(teamId, userId) {
  const { rows } = await query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows[0] ? rows[0].role : null;
}

/**
 * Creates a team and the owner's membership in a single transaction, so a
 * team can never exist without its creator being a member of it.
 */
async function createTeam({ name, description, userId }) {
  return withTransaction(async (client) => {
    const teamResult = await client.query(
      `INSERT INTO teams (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at, updated_at`,
      [name, description, userId]
    );

    const team = teamResult.rows[0];

    await client.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [team.id, userId]
    );

    return { ...toPublicTeam({ ...team, current_user_role: 'owner' }) };
  });
}

/**
 * Updates the name and description of a team.
 */
async function updateTeam(teamId, { name, description }) {
  const { rows } = await query(
    `UPDATE teams
        SET name = COALESCE($2, name),
            description = COALESCE($3, description)
      WHERE id = $1
      RETURNING id, name, description, created_by, created_at, updated_at`,
    [teamId, name ?? null, description ?? null]
  );

  return rows[0] || null;
}

/**
 * Deletes a team. The tasks and memberships of the team are removed by the
 * ON DELETE CASCADE constraints on the schema.
 */
async function deleteTeam(teamId) {
  const { rowCount } = await query('DELETE FROM teams WHERE id = $1', [teamId]);
  return rowCount > 0;
}

/**
 * Lists the members of a team.
 */
async function listMembers(teamId) {
  const { rows } = await query(
    `SELECT tm.user_id, tm.role, tm.joined_at, u.name, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1
      ORDER BY tm.role ASC, u.name ASC`,
    [teamId]
  );
  return rows.map(toPublicMember);
}

/**
 * Adds an existing registered user to a team.
 *
 * The user is located by their normalised email address. An unknown email is
 * reported as a 404 and an existing membership as a 409, so a duplicate is
 * never silently ignored.
 */
async function addMember(teamId, email) {
  const normalizedEmail = normalizeEmail(email);

  const userResult = await query(
    'SELECT id, name, email FROM users WHERE email = $1',
    [normalizedEmail]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw notFound('No registered user has that email address');
  }

  try {
    const { rows } = await query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING user_id, role, joined_at`,
      [teamId, user.id]
    );

    return toPublicMember({ ...rows[0], name: user.name, email: user.email });
  } catch (error) {
    // Unique violation on the team_members primary key.
    if (error.code === '23505') {
      throw conflict('That user is already a member of this team');
    }
    throw error;
  }
}

/**
 * Removes a member from a team.
 *
 * Tasks assigned to the removed member are unassigned by the database
 * constraint, because removing the membership row triggers
 * ON DELETE SET NULL (assigned_to) on tasks.
 */
async function removeMember(teamId, userId) {
  const { rowCount } = await query(
    'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rowCount > 0;
}

module.exports = {
  listTeamsForUser,
  findTeamForUser,
  getMemberRole,
  createTeam,
  updateTeam,
  deleteTeam,
  listMembers,
  addMember,
  removeMember,
  toPublicTeam,
  toPublicMember,
};
