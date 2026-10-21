'use strict';

const { badRequest, notFound } = require('../../utils/errors');
const service = require('./task.service');

const EDITABLE_FIELDS = ['title', 'description', 'status', 'dueDate', 'assignedTo'];

/**
 * GET /api/tasks
 * Lists the tasks of every team the current user belongs to, with the
 * optional filters of the API contract.
 */
async function listTasks(req, res, next) {
  try {
    const tasks = await service.listTasksForUser(req.user.id, {
      teamId: req.query.teamId ?? null,
      assigneeId: req.query.assigneeId ?? null,
      status: req.query.status ?? null,
      search: req.query.search ?? null,
    });

    return res.status(200).json({ data: { tasks } });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/tasks
 * Creates a task in a team the caller belongs to.
 */
async function createTask(req, res, next) {
  try {
    const task = await service.createTask({
      teamId: req.body.teamId,
      title: req.body.title,
      description: req.body.description,
      assignedTo: req.body.assignedTo ?? null,
      status: req.body.status,
      dueDate: req.body.dueDate ?? null,
      userId: req.user.id,
    });

    return res.status(201).json({ data: { task } });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/tasks/:taskId
 * Returns a task the caller can reach through one of their teams.
 */
async function getTask(req, res) {
  return res.status(200).json({ data: { task: req.task } });
}

/**
 * PATCH /api/tasks/:taskId
 * Updates the editable fields of a task. The creator of the task and the owner
 * of its team may do this.
 */
async function updateTask(req, res, next) {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'teamId')) {
      return next(badRequest('A task cannot be moved to another team'));
    }

    const changes = {};
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        changes[field] = req.body[field];
      }
    }

    const task = await service.updateTask(req.task, changes, req.user.id);

    if (!task) {
      return next(notFound('Task not found'));
    }

    return res.status(200).json({ data: { task } });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/tasks/:taskId
 * Deletes a task. The creator of the task and the owner of its team may do
 * this.
 */
async function deleteTask(req, res, next) {
  try {
    await service.deleteTask(req.task.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
};
