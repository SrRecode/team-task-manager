'use strict';

const { findTaskForUser } = require('../modules/tasks/task.service');
const { notFound } = require('../utils/errors');

/**
 * Loads the task named in the route and confirms that the caller can reach it
 * through one of their teams.
 *
 * The lookup is scoped to the caller's own membership, so a task of a team the
 * caller does not belong to is reported as 404 rather than 403. That keeps the
 * existence of somebody else's task concealed, the same way teams are.
 *
 * On success `req.task` holds the task and `req.taskRole` the caller's role in
 * the task's team.
 */
async function requireTaskAccess(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await findTaskForUser(taskId, req.user.id);

    if (!task) {
      return next(notFound('Task not found'));
    }

    req.task = task;
    req.taskRole = task.currentUserRole;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireTaskAccess };
