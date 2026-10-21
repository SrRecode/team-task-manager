'use strict';

const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const config = require('./env');
const { pool } = require('./database');

const PgSessionStore = connectPgSimple(session);

/**
 * Chooses the session store.
 *
 * Production always uses PostgreSQL (REQ-16). Outside production the
 * PostgreSQL store is used whenever a DATABASE_URL is configured; the
 * in-memory store is a development-only fallback and is reported loudly.
 */
function createSessionStore() {
  if (config.isProduction) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required in production for PostgreSQL session storage.');
    }
    return new PgSessionStore({ pool, tableName: 'session', createTableIfMissing: false });
  }

  if (config.databaseUrl) {
    return new PgSessionStore({ pool, tableName: 'session', createTableIfMissing: false });
  }

  console.warn(
    '[session] WARNING: no DATABASE_URL configured - using the in-memory session store. ' +
      'Sessions will not survive a restart and will not work across instances. ' +
      'This is a development-only fallback.'
  );
  return undefined;
}

const store = createSessionStore();

const sessionOptions = {
  name: config.sessionName,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store,
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.sessionSameSite,
    maxAge: config.sessionMaxAge,
    path: '/',
  },
};

module.exports = { session, sessionOptions, createSessionStore };
