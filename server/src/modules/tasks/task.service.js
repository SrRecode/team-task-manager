'use strict';

const { query } = require('../../config/database');
const { badRequest, notFound } = require('../../utils/errors');

const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const TASK_FIELDS = `
  t.id,
  t.team_id,
  t.title,
  t.description,
  t.assigned_to,
  t.created_by,
  t.status,
  t.due_date,
  t.created_at,
  t.updated_at
`;

/**
 * Maps a task row to the shape the client receives.
 */
function toPublicTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    description: row.description,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    createdBy: row.created_by,
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentUserRole: row.current_user_role ?? null,
  };
}

/**
 * Escapes the wildcard characters of a search term, so that a search for "50%"
 * looks for that text instead of matching everything.
 */
function toSearchPattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Returns the role a user holds in a team, or null when they are not a member.
 */
async function getTeamRole(teamId, userId) {
  const { rows } = await query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows[0] ? rows[0].role : null;
}

/**
 * Lists the tasks of every team the given user belongs to.
 *
 * The filters are optional and are always combined with the caller's team
 * access, so a filter can never widen what the caller is allowed to see.
 */
async function listTasksForUser(userId, filters = {}) {
  const { teamId = null, assigneeId = null, status = null, search = null } = filters;

  const { rows } = await query(
    `SELECT ${TASK_FIELDS},
            tm.role AS current_user_role,
            assignee.name AS assigned_to_name
       FROM tasks t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $1
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
      WHERE ($2::bigint IS NULL OR t.team_id = $2)
        AND ($3::bigint IS NULL OR t.assigned_to = $3)
        AND ($4::text IS NULL OR t.status = $4)
        AND ($5::text IS NULL
             OR t.title ILIKE '%' || $5 || '%' ESCAPE '\\'
             OR t.description ILIKE '%' || $5 || '%' ESCAPE '\\')
      ORDER BY t.created_at DESC, t.id DESC`,
    [userId, teamId, assigneeId, status, search]
  );

  return rows.map(toPublicTask);
}

/**
 * Returns a single task the given user can reach through one of their teams,
 * or null. The caller's role in the task's team is included.
 */
async function findTaskForUser(taskId, userId) {
  const { rows } = await query(
    `SELECT ${TASK_FIELDS},
            tm.role AS current_user_role,
            assignee.name AS assigned_to_name
       FROM tasks t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $2
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
      WHERE t.id = $1`,
    [taskId, userId]
  );

  return rows[0] ? toPublicTask(rows[0]) : null;
}

/**
 * Creates a task in a team the caller belongs to.
 *
 * The assignee has to be a member of the same team, which is also enforced by
 * the database constraint. The check is repeated here so the client gets a
 * readable validation error instead of a constraint violation.
 */
async function createTask({ teamId, title, description, assignedTo, status, dueDate, userId }) {
  const role = await getTeamRole(teamId, userId);
  if (!role) {
    throw notFound('Team not found');
  }

  if (assignedTo !== undefined && assignedTo !== null) {
    const assigneeRole = await getTeamRole(teamId, assignedTo);
    if (!assigneeRole) {
      throw badRequest('The assignee must be a member of the selected team');
    }
  }

  const { rows } = await query(
    `INSERT INTO tasks (team_id, title, description, assigned_to, created_by, status, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      teamId,
      title,
      description ?? '',
      assignedTo ?? null,
      userId,
      status ?? 'todo',
      dueDate ?? null,
    ]
  );

  return findTaskForUser(rows[0].id, userId);
}

/**
 * Updates the editable fields of a task.
 *
 * Only the fields present in `changes` are written, so a field can also be
 * cleared by sending null. A task always stays in its own team.
 */
async function updateTask(task, changes, userId) {
  const columns = [];
  const values = [task.id];

  const add = (column, value) => {
    values.push(value);
    columns.push(`${column} = $${values.length}`);
  };

  if (changes.title !== undefined) add('title', changes.title);
  if (changes.description !== undefined) add('description', changes.description);
  if (changes.status !== undefined) add('status', changes.status);
  if (changes.dueDate !== undefined) add('due_date', changes.dueDate);
  if (changes.assignedTo !== undefined) {
    if (changes.assignedTo !== null) {
      const assigneeRole = await getTeamRole(task.teamId, changes.assignedTo);
      if (!assigneeRole) {
        throw badRequest('The assignee must be a member of the selected team');
      }
    }
    add('assigned_to', changes.assignedTo);
  }

  if (columns.length === 0) {
    return findTaskForUser(task.id, userId);
  }

  const { rows } = await query(
    `UPDATE tasks
        SET ${columns.join(', ')}
      WHERE id = $1
      RETURNING id`,
    values
  );

  if (!rows[0]) {
    throw notFound('Task not found');
  }

  return findTaskForUser(rows[0].id, userId);
}

/**
 * Deletes a task.
 */
async function deleteTask(taskId) {
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [taskId]);
  return rowCount > 0;
}

/**
 * The task mutation policy: a task may be changed by the member who created
 * it and by the owner of its team. Everybody else in the team may read it.
 */
function canEditTask(task, userId) {
  if (!task) return false;
  if (task.currentUserRole === 'owner') return true;
  return Number(task.createdBy) === Number(userId);
}

module.exports = {
  TASK_STATUSES,
  listTasksForUser,
  findTaskForUser,
  getTeamRole,
  createTask,
  updateTask,
  deleteTask,
  canEditTask,
  toPublicTask,
};
