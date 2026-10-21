'use strict';

const { query } = require('../../config/database');
const { toPublicTask } = require('../tasks/task.service');

/**
 * How many days ahead the "upcoming" group reaches.
 */
const UPCOMING_WINDOW_DAYS = 7;

const REMINDER_FIELDS = `
  t.id,
  t.team_id,
  t.title,
  t.description,
  t.assigned_to,
  t.created_by,
  t.status,
  t.due_date,
  t.created_at,
  t.updated_at,
  te.name AS team_name,
  CASE
    WHEN t.due_date < CURRENT_DATE THEN 'overdue'
    WHEN t.due_date = CURRENT_DATE THEN 'today'
    ELSE 'upcoming'
  END AS reminder_bucket
`;

/**
 * Collects the due-date reminders of the signed in user.
 *
 * A reminder is a task that is assigned to the user, is not finished yet and
 * has a due date. The current date is taken from the database (CURRENT_DATE),
 * so the server and the database always agree on what "today" is, whatever the
 * time zone of the browser is.
 *
 * The tasks are limited to the teams the user belongs to, exactly like the
 * task list, so a reminder can never expose a task of somebody else's team.
 */
async function listRemindersForUser(userId) {
  const { rows } = await query(
    `SELECT ${REMINDER_FIELDS}
       FROM tasks t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $1
       JOIN teams te ON te.id = t.team_id
      WHERE t.assigned_to = $1
        AND t.status <> 'done'
        AND t.due_date IS NOT NULL
        AND t.due_date <= CURRENT_DATE + $2::int
      ORDER BY t.due_date ASC, t.id ASC`,
    [userId, UPCOMING_WINDOW_DAYS]
  );

  const groups = { overdue: [], today: [], upcoming: [] };

  for (const row of rows) {
    const task = { ...toPublicTask(row), teamName: row.team_name ?? null };
    groups[row.reminder_bucket].push(task);
  }

  return {
    reminders: groups,
    counts: {
      overdue: groups.overdue.length,
      today: groups.today.length,
      upcoming: groups.upcoming.length,
      total: groups.overdue.length + groups.today.length + groups.upcoming.length,
    },
    windowDays: UPCOMING_WINDOW_DAYS,
  };
}

module.exports = { listRemindersForUser, UPCOMING_WINDOW_DAYS };
