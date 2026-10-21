'use strict';

const bcrypt = require('bcrypt');
const { query } = require('../../config/database');
const { BCRYPT_ROUNDS } = require('../../config/passwords');
const { normalizeEmail } = require('../../utils/email');
const { conflict } = require('../../utils/errors');

const PUBLIC_FIELDS = 'id, name, email, created_at';

/**
 * Maps a user row to the safe public shape that may be sent to the client.
 * `password_hash` is never included.
 */
function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Creates a user with a bcrypt-hashed password.
 * A duplicate email is reported as a 409 conflict.
 */
async function createUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING ${PUBLIC_FIELDS}`,
      [name, normalizedEmail, passwordHash]
    );
    return rows[0];
  } catch (error) {
    // Postgres unique violation code for the users_email_key index.
    if (error.code === '23505') {
      throw conflict('An account with that email address already exists');
    }
    throw error;
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  toPublicUser,
  normalizeEmail,
};
