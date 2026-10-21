'use strict';

const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (error) => {
  // A pooled client can fail while idle. Log it; the pool will replace it.
  console.error('[db] idle client error:', error.message);
});

/**
 * Runs a parameterized query. Never interpolate user input into the SQL text.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Runs `fn` inside a transaction, committing on success and rolling back on
 * any error. The client is always released back to the pool.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, closePool };
