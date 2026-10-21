'use strict';

const { AppError } = require('../utils/errors');

const NOT_FOUND = new AppError(404, 'NOT_FOUND', 'The requested route does not exist');

/**
 * Translates the body-parser errors into safe client responses. Without this
 * a malformed or oversized request body would be reported as a 500.
 */
function fromBodyParserError(error) {
  if (error.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON');
  }

  if (error.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large');
  }

  return null;
}

/**
 * Central error handler. Expected errors keep their status code and a safe
 * message; anything unexpected is reported as a generic 500 so that stack
 * traces, SQL text and internal details never reach the client.
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let appError = error instanceof AppError ? error : fromBodyParserError(error);

  if (!appError && error instanceof Error && error.expose === true && error.status >= 400 && error.status < 500) {
    appError = new AppError(error.status, 'BAD_REQUEST', error.message);
  }

  const isAppError = appError !== null && appError !== undefined;

  if (!isAppError) {
    // Only unexpected failures are logged. Request bodies are never logged.
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  const statusCode = isAppError ? appError.statusCode : 500;
  const code = isAppError ? appError.code : 'INTERNAL_ERROR';
  const message = isAppError
    ? appError.message
    : 'An unexpected error occurred while processing the request';

  const body = { error: { code, message } };
  if (isAppError && appError.details) body.error.details = appError.details;

  res.status(statusCode).json(body);
}

/**
 * Handles requests that matched no route.
 */
function notFoundHandler(req, res, next) {
  next(NOT_FOUND);
}

module.exports = { errorHandler, notFoundHandler };
