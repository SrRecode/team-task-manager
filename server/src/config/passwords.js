'use strict';

/**
 * Cost factor for bcrypt. Higher is slower and safer.
 * 12 is the current sensible default for an interactive login.
 */
const BCRYPT_ROUNDS = 12;

module.exports = { BCRYPT_ROUNDS };
