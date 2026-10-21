'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/requireAuth');
const { requireTaskAccess } = require('../../middleware/requireTaskAccess');
const { requireTaskEditor } = require('../../middleware/requireTaskEditor');
const controller = require('./task.controller');
const { TASK_STATUSES } = require('./task.service');

const router = express.Router();

// Every field is described by a factory, because an express-validator chain is
// a mutable object: sharing one instance between two routes would leak the
// modifiers of one route into the other.

const taskIdField = () =>
  param('taskId')
    .isInt({ min: 1 })
    .withMessage('The task id must be a positive integer')
    .toInt();

const teamIdField = () =>
  body('teamId')
    .isInt({ min: 1 })
    .withMessage('The team id must be a positive integer')
    .toInt();

const titleField = (optional = false) => {
  const field = body('title');
  if (optional) field.optional();
  return field
    .isString()
    .withMessage('A task title is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('The task title must be between 1 and 200 characters');
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

const statusField = (optional = false) => {
  const field = body('status');
  if (optional) field.optional();
  return field
    .isIn(TASK_STATUSES)
    .withMessage(`The status must be one of: ${TASK_STATUSES.join(', ')}`);
};

const assigneeField = () =>
  body('assignedTo')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('The assignee must be a user id')
    .toInt();

const dueDateField = () =>
  body('dueDate')
    .optional({ nullable: true })
    .isString()
    .withMessage('The due date must be text')
    .bail()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('The due date must be a date in YYYY-MM-DD format')
    .bail()
    .custom((value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    })
    .withMessage('The due date must be a real calendar date');

const teamIdQuery = () =>
  query('teamId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('The team id must be a positive integer')
    .toInt();

const assigneeIdQuery = () =>
  query('assigneeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('The assignee id must be a positive integer')
    .toInt();

const statusQuery = () =>
  query('status')
    .optional()
    .isIn(TASK_STATUSES)
    .withMessage(`The status must be one of: ${TASK_STATUSES.join(', ')}`);

const searchQuery = () =>
  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('The search term must be at most 200 characters');

router.use(requireAuth);

router.get(
  '/',
  teamIdQuery(),
  assigneeIdQuery(),
  statusQuery(),
  searchQuery(),
  validate,
  controller.listTasks
);

router.post(
  '/',
  teamIdField(),
  titleField(),
  descriptionField(true),
  statusField(true),
  assigneeField(),
  dueDateField(),
  validate,
  controller.createTask
);

router.get('/:taskId', taskIdField(), validate, requireTaskAccess, controller.getTask);

router.patch(
  '/:taskId',
  taskIdField(),
  titleField(true),
  descriptionField(true),
  statusField(true),
  assigneeField(),
  dueDateField(),
  validate,
  requireTaskAccess,
  requireTaskEditor,
  controller.updateTask
);

router.delete('/:taskId', taskIdField(), validate, requireTaskAccess, requireTaskEditor, controller.deleteTask);

module.exports = router;
