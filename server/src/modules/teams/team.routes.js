'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/requireAuth');
const { requireTeamMember } = require('../../middleware/requireTeamMember');
const { requireTeamOwner } = require('../../middleware/requireTeamOwner');
const controller = require('./team.controller');

const router = express.Router();

// Every field is described by a factory, because an express-validator chain is
// a mutable object: sharing one instance between two routes would leak the
// modifiers of one route into the other. The name of a team is required when
// a team is created and optional when it is updated.

const teamIdField = () =>
  param('teamId')
    .isInt({ min: 1 })
    .withMessage('The team id must be a positive integer')
    .toInt();

const nameField = (optional = false) => {
  const field = body('name');
  if (optional) field.optional();
  return field
    .isString()
    .withMessage('A team name is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('The team name must be between 1 and 120 characters');
};

const descriptionField = (optional = false) => {
  const field = body('description');
  if (optional) field.optional();
  return field
    .isString()
    .withMessage('The description must be text')
    .bail()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('The description must be at most 2000 characters');
};

const emailField = () =>
  body('email')
    .isString()
    .withMessage('An email address is required')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email address is required');

const inviteIdField = () =>
  param('inviteId')
    .isInt({ min: 1 })
    .withMessage('The invitation id must be a positive integer')
    .toInt();

router.use(requireAuth);

router.get('/', controller.listTeams);

router.post(
  '/',
  nameField(),
  descriptionField(true),
  validate,
  controller.createTeam
);

router.get('/:teamId', teamIdField(), validate, requireTeamMember, controller.getTeam);

router.patch(
  '/:teamId',
  teamIdField(),
  nameField(true),
  descriptionField(true),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.updateTeam
);

router.delete(
  '/:teamId',
  teamIdField(),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.deleteTeam
);

router.get(
  '/:teamId/members',
  teamIdField(),
  validate,
  requireTeamMember,
  controller.listMembers
);

router.post(
  '/:teamId/members',
  teamIdField(),
  body('email')
    .isString()
    .withMessage('An email address is required')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email address is required'),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.addMember
);

router.delete(
  '/:teamId/members/:userId',
  teamIdField(),
  param('userId')
    .isInt({ min: 1 })
    .withMessage('The user id must be a positive integer')
    .toInt(),
  validate,
  requireTeamMember,
  controller.removeMember
);

// Invitations (BONUS-03). The invitation is a record instead of an email:
// there is no mail server, so the invitee becomes a member when the address
// registers or signs in.

router.get(
  '/:teamId/invites',
  teamIdField(),
  validate,
  requireTeamMember,
  controller.listInvites
);

router.post(
  '/:teamId/invites',
  teamIdField(),
  emailField(),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.createInvite
);

router.delete(
  '/:teamId/invites/:inviteId',
  teamIdField(),
  inviteIdField(),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.revokeInvite
);

module.exports = router;
