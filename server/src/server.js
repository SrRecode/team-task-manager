'use strict';

const config = require('./config/env');
const { createApp } = require('./app');
const { closePool } = require('./config/database');

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[server] allowed origins: ${config.allowedOrigins.join(', ')}`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
