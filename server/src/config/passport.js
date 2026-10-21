'use strict';

const { Strategy: LocalStrategy } = require('passport-local');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { findUserByEmail, findUserById } = require('../modules/auth/auth.service');

// A real bcrypt hash of a value nobody knows. It is compared against when no
// account matches, so that an unknown email costs the same time as a known
// email with a wrong password and the endpoint cannot be used to enumerate
// registered accounts.
const TIMING_EQUALIZER_HASH =
  '$2b$12$0qyaO3mf0OWCTt5bTbTGUe4Gysp8qQM6gfAbb14HqVliFYzMQP2Be';

/**
 * Verifies credentials against the stored bcrypt hash.
 * The failure message is identical for an unknown email and a wrong password
 * so the endpoint cannot be used to enumerate registered accounts.
 */
const localStrategy = new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = await findUserByEmail(email);

      if (!user) {
        await bcrypt.compare(password, TIMING_EQUALIZER_HASH);
        return done(null, false);
      }

      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) return done(null, false);

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
);

passport.use(localStrategy);

// Only the user id is stored in the session. The password hash is never
// serialized into the session store.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(Number(id));
    if (!user) return done(null, false);
    return done(null, user);
  } catch (error) {
    return done(error);
  }
});

module.exports = { passport };
