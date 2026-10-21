'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/requireAuth');
const { requireTeamMember } = require('../../middleware/requireTeamMember');
const { requireTeamOwner } = require('../../middleware/requireTeamOwner');
const controller = require('./team.controller');

const router = express.Router();

const teamIdField = param('teamId')
  .isInt({ min: 1 })
  .withMessage('The team id must be a positive integer')
  .toInt();

const nameField = body('name')
  .isString()
  .withMessage('A team name is required')
  .bail()
  .trim()
  .isLength({ min: 1, max: 120 })
  .withMessage('The team name must be between 1 and 120 characters');

const descriptionField = body('description')
  .optional()
  .isString()
  .withMessage('The description must be text')
  .bail()
  .trim()
  .isLength({ max: 2000 })
  .withMessage('The description must be at most 2000 characters');

router.use(requireAuth);

router.get('/', controller.listTeams);

router.post(
  '/',
  nameField,
  descriptionField,
  validate,
  controller.createTeam
);

router.get('/:teamId', teamIdField, validate, requireTeamMember, controller.getTeam);

router.patch(
  '/:teamId',
  teamIdField,
  nameField.optional(),
  descriptionField.optional(),
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.updateTeam
);

router.delete(
  '/:teamId',
  teamIdField,
  validate,
  requireTeamMember,
  requireTeamOwner,
  controller.deleteTeam
);

router.get(
  '/:teamId/members',
  teamIdField,
  validate,
  requireTeamMember,
  controller.listMembers
);

router.post(
  '/:teamId/members',
  teamIdField,
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
  teamIdField,
  param('userId')
    .isInt({ min: 1 })
    .withMessage('The user id must be a positive integer')
    .toInt(),
  validate,
  requireTeamMember,
  controller.removeMember
);

module.exports = router;
