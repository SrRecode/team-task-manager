'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config/env');
const { session, sessionOptions } = require('./config/session');
const { passport } = require('./config/passport');
const { query, closePool } = require('./config/database');
const { verifyOrigin } = require('./middleware/csrfOrigin');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { AppError } = require('./utils/errors');
const authRoutes = require('./modules/auth/auth.routes');
const teamRoutes = require('./modules/teams/team.routes');
const taskRoutes = require('./modules/tasks/task.routes');
const reminderRoutes = require('./modules/reminders/reminder.routes');

function createApp() {
  const app = express();

  // Cloud Run terminates TLS in front of the service, so the client IP has to
  // be taken from the proxy for `secure` cookies to be issued.
  if (config.isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  // 1. Security headers
  app.use(helmet());

  // 2. Request body parsers with a size limit
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // 3. CORS, restricted to the exact trusted frontend origins
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (config.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(
          new AppError(403, 'CORS_DENIED', 'This origin is not allowed to call the API')
        );
      },
      credentials: true,
    })
  );

  if (!config.isTest) {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  // 4. Session
  app.use(session(sessionOptions));

  // 5. Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // CSRF origin check for cookie-authenticated state-changing requests
  app.use(verifyOrigin);

  // 6. Health endpoint
  app.get('/health', async (req, res) => {
    if (req.query.database !== 'true') {
      return res.status(200).json({ status: 'ok' });
    }

    try {
      await query('SELECT 1');
      return res.status(200).json({ status: 'ok', database: 'up' });
    } catch {
      return res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  // 7. API routers
  app.use('/api/auth', authRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reminders', reminderRoutes);

  // 8. Not found
  app.use(notFoundHandler);

  // 9. Central error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, closePool };
