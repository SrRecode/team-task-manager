'use strict';

const config = require('../../config/env');
const { createUser, toPublicUser } = require('./auth.service');
const { unauthorized } = require('../../utils/errors');

/**
 * POST /api/auth/register
 *
 * Creates the account and establishes an authenticated session.
 * Passport regenerates the session id on logIn, which prevents session
 * fixation (docs/SECURITY.md section 3).
 */
async function register(req, res, next) {
  try {
    const user = await createUser({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    });

    req.logIn(user, (error) => {
      if (error) return next(error);
      return res.status(201).json({ data: { user: toPublicUser(user) } });
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/login
 *
 * The credential check itself is performed by the Passport Local strategy.
 * This handler only runs after the strategy succeeded, and Passport has
 * already regenerated the session id, which prevents session fixation
 * (docs/SECURITY.md section 3).
 */
function login(req, res) {
  return res.status(200).json({ data: { user: toPublicUser(req.user) } });
}

/**
 * POST /api/auth/logout
 *
 * Destroys the server-side session and clears the cookie with matching
 * options so the browser stops sending it.
 */
function logout(req, res, next) {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);

    req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);

      res.clearCookie(config.sessionName, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: config.sessionSameSite,
        path: '/',
      });

      return res.status(204).send();
    });
  });
}

/**
 * GET /api/auth/me
 *
 * Returns the profile of the currently authenticated user.
 */
function me(req, res, next) {
  if (!req.user) return next(unauthorized());
  return res.status(200).json({ data: { user: toPublicUser(req.user) } });
}

module.exports = { register, login, logout, me };
