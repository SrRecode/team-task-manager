'use strict';

const { forbidden } = require('../utils/errors');

/**
 * Requires the caller to be the owner of the team loaded by
 * requireTeamMember. A member who is not the owner gets 403, because they
 * already know the team exists.
 */
function requireTeamOwner(req, res, next) {
  if (req.teamRole !== 'owner') {
    return next(forbidden('Only the team owner can perform this action'));
  }

  return next();
}

module.exports = { requireTeamOwner };
