'use strict';

const service = require('./reminder.service');

/**
 * GET /api/reminders
 *
 * The due-date reminders of the signed in user (BONUS-01).
 */
async function listReminders(req, res, next) {
  try {
    const reminders = await service.listRemindersForUser(req.user.id);
    return res.status(200).json({ data: { reminders } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listReminders };
