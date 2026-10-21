'use strict';

const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/requireAuth');
const { unauthorized } = require('../../utils/errors');
const controller = require('./auth.controller');
const { passport } = require('../../config/passport');

const router = express.Router();

const emailField = body('email')
  .isString()
  .withMessage('A valid email address is required')
  .bail()
  .trim()
  .isEmail()
  .withMessage('A valid email address is required')
  .bail()
  // Provider specific rewrites (dropping dots or "+tags") are deliberately
  // disabled, because those characters are significant for some providers.
  // Only whitespace trimming and lowercasing are applied, which keeps the
  // stored value identical to docs/DATABASE.md section 4.
  .normalizeEmail({
    all_lowercase: true,
    gmail_lowercase: true,
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: false,
    outlookdotcom_lowercase: true,
    outlookdotcom_remove_subaddress: false,
    yahoo_lowercase: true,
    yahoo_remove_subaddress: false,
    icloud_lowercase: true,
    icloud_remove_subaddress: false,
  });

const passwordField = body('password')
  .isString()
  .withMessage('A password is required')
  .isLength({ min: 8, max: 200 })
  .withMessage('Password must be between 8 and 200 characters');

router.post(
  '/register',
  body('name')
    .isString()
    .withMessage('A name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  emailField,
  passwordField,
  validate,
  controller.register
);

router.post(
  '/login',
  emailField,
  passwordField,
  validate,
  (req, res, next) => {
    passport.authenticate(
      'local',
      { session: true },
      (error, user) => {
        if (error) return next(error);

        // The same message is returned for an unknown email and for a wrong
        // password, so the endpoint cannot be used to enumerate accounts.
        if (!user) return next(unauthorized('Invalid email or password'));

        // Passport regenerates the session id here, which prevents session
        // fixation. Only the user id is written to the session.
        return req.logIn(user, (loginError) => {
          if (loginError) return next(loginError);
          return controller.login(req, res, next);
        });
      }
    )(req, res, next);
  }
);

router.post('/logout', requireAuth, controller.logout);

router.get('/me', requireAuth, controller.me);

module.exports = router;
