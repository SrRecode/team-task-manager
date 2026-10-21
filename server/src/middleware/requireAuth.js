'use strict';

const { unauthorized } = require('../utils/errors');

/**
 * Rejects any request that does not carry a valid authenticated session.
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return next(unauthorized());
}

module.exports = { requireAuth };
