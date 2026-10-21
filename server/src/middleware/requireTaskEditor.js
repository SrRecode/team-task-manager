'use strict';

const { canEditTask } = require('../modules/tasks/task.service');
const { forbidden } = require('../utils/errors');

/**
 * Requires the caller to be allowed to change the task loaded by
 * requireTaskAccess: the member who created it, or the owner of its team.
 *
 * A member who may not change the task gets 403, because the membership check
 * has already confirmed that the task is visible to them.
 */
function requireTaskEditor(req, res, next) {
  if (!canEditTask(req.task, req.user.id)) {
    return next(forbidden('Only the task creator or the team owner can change this task'));
  }

  return next();
}

module.exports = { requireTaskEditor };
