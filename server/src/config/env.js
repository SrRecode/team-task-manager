'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

function readBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function readList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Validates that the environment contains everything the server needs to run.
 * Fails fast with an actionable message instead of starting in a broken state.
 */
function loadConfig() {
  const missing = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (isProduction && !process.env.CLIENT_ORIGIN) missing.push('CLIENT_ORIGIN');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy server/.env.example to server/.env and fill in the values.'
    );
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  return {
    nodeEnv: NODE_ENV,
    isProduction,
    isTest,
    port: Number(process.env.PORT) || 5000,
    databaseUrl: process.env.DATABASE_URL,
    databaseSsl: readBoolean(process.env.DATABASE_SSL, false),
    sessionSecret: process.env.SESSION_SECRET,
    sessionName: process.env.SESSION_NAME || 'glacier.sid',
    sessionMaxAge: Number(process.env.SESSION_MAX_AGE_MS) || 24 * 60 * 60 * 1000,
    sessionSameSite: process.env.SESSION_SAME_SITE || 'lax',
    clientOrigin,
    allowedOrigins: [clientOrigin, ...readList(process.env.EXTRA_ALLOWED_ORIGINS)],
  };
}

const config = loadConfig();

module.exports = config;
