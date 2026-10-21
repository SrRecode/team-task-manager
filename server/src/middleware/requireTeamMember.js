'use strict';

const { findTeamForUser } = require('../modules/teams/team.service');
const { notFound } = require('../utils/errors');

/**
 * Loads the team named in the route and confirms the caller is a member of it.
 *
 * The lookup is scoped to the caller's own membership, so a team the caller
 * cannot access is reported as 404 rather than 403. That keeps the existence
 * of somebody else's team concealed (docs/API.md section 4).
 *
 * On success `req.team` holds the team and `req.teamRole` the caller's role.
 */
async function requireTeamMember(req, res, next) {
  try {
    const teamId = Number(req.params.teamId);
    const team = await findTeamForUser(teamId, req.user.id);

    if (!team) {
      return next(notFound('Team not found'));
    }

    req.team = team;
    req.teamRole = team.currentUserRole;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireTeamMember };
