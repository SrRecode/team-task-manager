'use strict';

const config = require('../config/env');
const { forbidden } = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 *
 * The session cookie is sent by the browser automatically, so a request from
 * another site would otherwise be authenticated. This middleware checks the
 * `Origin` header (and `Referer` as a fallback) against the trusted frontend
 * origins and rejects the request when they do not match.
 *
 * This is the "origin-check" strategy described in docs/SECURITY.md, and it is
 * combined with a `SameSite` session cookie so that a cross-site form post
 * does not carry the session in the first place.
 */
function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    if (!config.allowedOrigins.includes(origin)) {
      return next(forbidden('Request origin is not allowed'));
    }
    return next();
  }

  const referer = req.get('referer');
  if (referer) {
    const refererOrigin = originOf(referer);
    if (refererOrigin && !config.allowedOrigins.includes(refererOrigin)) {
      return next(forbidden('Request origin is not allowed'));
    }
  }

  return next();
}

module.exports = { verifyOrigin };
