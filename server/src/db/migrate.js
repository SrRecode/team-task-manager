'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pool, closePool } = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/**
 * Applies every migration that has not been applied yet, in file-name order.
 * Each migration runs inside its own transaction, so a failure leaves the
 * database on the last successfully applied migration.
 *
 * This is a deliberate release step. It is never triggered by an HTTP request.
 */
async function runMigrations() {
  const client = await pool.connect();
  const applied = [];

  try {
    await client.query(CREATE_TRACKING_TABLE);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.name));

    for (const file of listMigrationFiles()) {
      if (alreadyApplied.has(file)) {
        console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${file}`);
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }
  } finally {
    client.release();
  }

  if (applied.length === 0) {
    console.log('[migrate] schema is already up to date');
  } else {
    console.log(`[migrate] ${applied.length} migration(s) applied`);
  }

  return applied;
}

if (require.main === module) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error('[migrate]', error.message);
      await closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = { runMigrations, listMigrationFiles };
