'use strict';

/**
 * Test database bootstrap.
 *
 * This module must be required BEFORE anything that loads src/config/env.js,
 * because the configuration is read from process.env once at startup.
 *
 * It points the application at the dedicated test database
 * (glacier_tasks_test) derived from DATABASE_URL, so the tests never touch
 * development data.
 */

const path = require('node:path');
const dotenv = require('dotenv');

const SERVER_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the server tests. Copy server/.env.example to server/.env first.'
  );
}

const testDatabaseName = process.env.TEST_DATABASE_NAME || 'glacier_tasks_test';
const testUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, `/${testDatabaseName}$2`);

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-not-used-in-production';

const { runMigrations } = require('../src/db/migrate');
const { query, closePool } = require('../src/config/database');

let prepared = false;

/**
 * Applies the migrations to the test database and clears every table.
 */
async function prepareDatabase() {
  if (!prepared) {
    await runMigrations();
    prepared = true;
  }

  await query('TRUNCATE tasks, team_members, teams, users RESTART IDENTITY CASCADE');
  await query('TRUNCATE session');
}

async function closeDatabase() {
  await closePool();
}

module.exports = { prepareDatabase, closeDatabase, testUrl };
