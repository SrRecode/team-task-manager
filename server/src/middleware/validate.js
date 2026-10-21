'use strict';

const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/errors');

/**
 * Turns express-validator results into the shared error shape:
 *   { error: { code, message, details } }
 */
function validate(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) return next();

  const details = result.array().map((entry) => ({
    field: entry.path ?? entry.param,
    message: entry.msg,
  }));

  return next(badRequest('Request validation failed', details));
}

module.exports = { validate };
