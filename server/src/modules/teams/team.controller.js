'use strict';

const { forbidden, notFound } = require('../../utils/errors');
const service = require('./team.service');

/**
 * GET /api/teams
 * Lists the teams the current user belongs to.
 */
async function listTeams(req, res, next) {
  try {
    const teams = await service.listTeamsForUser(req.user.id);
    return res.status(200).json({ data: { teams } });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/teams
 * Creates a team and makes the caller its owner.
 */
async function createTeam(req, res, next) {
  try {
    const team = await service.createTeam({
      name: req.body.name,
      description: req.body.description ?? '',
      userId: req.user.id,
    });
    return res.status(201).json({ data: { team } });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/teams/:teamId
 * Returns a team the caller is a member of.
 */
async function getTeam(req, res) {
  return res.status(200).json({ data: { team: req.team } });
}

/**
 * PATCH /api/teams/:teamId
 * Updates the name and description. Owner only.
 */
async function updateTeam(req, res, next) {
  try {
    const updated = await service.updateTeam(req.team.id, {
      name: req.body.name,
      description: req.body.description,
    });

    if (!updated) {
      return next(notFound('Team not found'));
    }

    return res.status(200).json({
      data: { team: { ...updated, currentUserRole: req.teamRole } },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/teams/:teamId
 * Deletes a team and everything in it. Owner only.
 */
async function deleteTeam(req, res, next) {
  try {
    await service.deleteTeam(req.team.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/teams/:teamId/members
 * Lists the members of a team. Any member of the team may read this.
 */
async function listMembers(req, res, next) {
  try {
    const members = await service.listMembers(req.team.id);
    return res.status(200).json({ data: { members } });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/teams/:teamId/members
 * Adds an existing registered user to the team. Owner only.
 */
async function addMember(req, res, next) {
  try {
    const member = await service.addMember(req.team.id, req.body.email);
    return res.status(201).json({ data: { member } });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/teams/:teamId/members/:userId
 * Removes a member from the team.
 *
 * The owner may remove anybody. A member may remove themselves, so leaving a
 * team is always possible. The owner may not remove themselves: a team without
 * an owner could never be managed or deleted again, so the owner has to delete
 * the team instead.
 */
async function removeMember(req, res, next) {
  try {
    const targetUserId = Number(req.params.userId);
    const isSelf = targetUserId === req.user.id;

    if (!isSelf && req.teamRole !== 'owner') {
      return next(forbidden('Only the team owner can remove another member'));
    }

    if (isSelf && req.teamRole === 'owner') {
      return next(
        forbidden('The team owner cannot leave the team. Delete the team instead.')
      );
    }

    const removed = await service.removeMember(req.team.id, targetUserId);

    if (!removed) {
      return next(notFound('That user is not a member of this team'));
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTeams,
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  listMembers,
  addMember,
  removeMember,
};
