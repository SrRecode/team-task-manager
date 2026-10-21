/**
 * Client side validation of the forms.
 *
 * The rules mirror the rules of the API (`server/src/modules/**`): the browser
 * answers immediately, the API stays the authority. A field that passes here
 * can still be rejected by the server, and the message of the server is shown
 * next to the input that caused it.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a `YYYY-MM-DD` string is a real calendar date, for example
 * `2026-02-30` is not.
 */
export function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * The message of an email field, or null when the address is acceptable.
 */
export function validateEmail(value) {
  const email = (value ?? '').trim();

  if (!email) return 'An email address is required';
  if (!EMAIL_PATTERN.test(email)) return 'A valid email address is required';

  return null;
}

/**
 * The message of a password field, or null when the password is acceptable.
 */
export function validatePassword(value) {
  const password = value ?? '';

  if (!password) return 'A password is required';
  if (password.length < 8 || password.length > 200) {
    return 'The password must be between 8 and 200 characters';
  }

  return null;
}

/**
 * The message of a name field, or null when the name is acceptable.
 */
export function validateName(value) {
  const name = (value ?? '').trim();

  if (!name) return 'A name is required';
  if (name.length > 100) return 'The name must be at most 100 characters';

  return null;
}

/**
 * The message of a team name field, or null when the name is acceptable.
 */
export function validateTeamName(value) {
  const name = (value ?? '').trim();

  if (!name) return 'A team name is required';
  if (name.length > 120) return 'The team name must be at most 120 characters';

  return null;
}

/**
 * The message of a description field, or null when the description is
 * acceptable.
 */
export function validateDescription(value) {
  const description = (value ?? '').trim();

  if (description.length > 2000) return 'The description must be at most 2000 characters';

  return null;
}

/**
 * The message of a task title field, or null when the title is acceptable.
 */
export function validateTaskTitle(value) {
  const title = (value ?? '').trim();

  if (!title) return 'A task title is required';
  if (title.length > 200) return 'The task title must be at most 200 characters';

  return null;
}

/**
 * The message of a due date field, or null when the date is acceptable. An
 * empty field is allowed: a task does not need a due date.
 */
export function validateDueDate(value) {
  const dueDate = (value ?? '').trim();

  if (!dueDate) return null;
  if (!DATE_PATTERN.test(dueDate)) return 'The due date must be a date in YYYY-MM-DD format';
  if (!isRealDate(dueDate)) return 'The due date must be a real calendar date';

  return null;
}

/**
 * The errors of the sign in form, keyed by field name.
 */
export function validateLogin(values) {
  const errors = {};

  const email = validateEmail(values.email);
  if (email) errors.email = email;

  const password = validatePassword(values.password);
  if (password) errors.password = password;

  return errors;
}

/**
 * The errors of the registration form, keyed by field name.
 */
export function validateRegister(values) {
  const errors = {};

  const name = validateName(values.name);
  if (name) errors.name = name;

  const email = validateEmail(values.email);
  if (email) errors.email = email;

  const password = validatePassword(values.password);
  if (password) errors.password = password;

  return errors;
}

/**
 * The errors of the task form, keyed by field name.
 */
export function validateTask(values) {
  const errors = {};

  const title = validateTaskTitle(values.title);
  if (title) errors.title = title;

  if (!values.teamId) {
    errors.teamId = 'A task needs a team';
  }

  const description = validateDescription(values.description);
  if (description) errors.description = description;

  const dueDate = validateDueDate(values.dueDate);
  if (dueDate) errors.dueDate = dueDate;

  return errors;
}

/**
 * The errors of the team form, keyed by field name.
 */
export function validateTeam(values) {
  const errors = {};

  const name = validateTeamName(values.name);
  if (name) errors.name = name;

  const description = validateDescription(values.description);
  if (description) errors.description = description;

  return errors;
}

/**
 * Whether a set of field errors is empty.
 */
export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
