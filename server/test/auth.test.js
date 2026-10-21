'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { prepareDatabase, closeDatabase } = require('../test-support/database');
const { createApp } = require('../src/app');
const { query } = require('../src/config/database');
const { verifyOrigin } = require('../src/middleware/csrfOrigin');

const app = createApp();

const VALID_USER = {
  name: 'Ayesha Khan',
  email: 'ayesha@example.com',
  password: 'a-long-user-chosen-password',
};

/**
 * Extracts the session id value from a Set-Cookie header list.
 */
function sessionIdFrom(setCookieHeaders = []) {
  const header = setCookieHeaders.find((cookie) => cookie.startsWith('glacier.sid='));
  if (!header) return null;
  return header.split(';')[0].split('=')[1];
}

test.before(async () => {
  await prepareDatabase();
});

test.after(async () => {
  await closeDatabase();
});

test.beforeEach(async () => {
  await prepareDatabase();
});

test('health endpoint reports the service is up', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, undefined);
});

test('health endpoint can report database connectivity', async () => {
  const response = await request(app).get('/health?database=true');

  assert.equal(response.status, 200);
  assert.equal(response.body.database, 'up');
});

test('register creates the account, returns a safe user and establishes a session', async () => {
  const response = await request(app).post('/api/auth/register').send(VALID_USER);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.email, 'ayesha@example.com');
  assert.equal(response.body.data.user.name, 'Ayesha Khan');
  assert.equal(response.body.data.user.password_hash, undefined);
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.ok(response.body.data.user.id);

  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(
    setCookie.some((cookie) => cookie.startsWith('glacier.sid=')),
    'expected a session cookie to be set'
  );
  assert.ok(
    setCookie.some((cookie) => /HttpOnly/i.test(cookie)),
    'expected the session cookie to be HttpOnly'
  );
});

test('register stores a bcrypt hash and never the plaintext password', async () => {
  await request(app).post('/api/auth/register').send(VALID_USER);

  const { rows } = await query('SELECT password_hash FROM users WHERE email = $1', [
    VALID_USER.email,
  ]);

  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].password_hash, VALID_USER.password);
  assert.match(rows[0].password_hash, /^\$2[aby]\$/, 'expected a bcrypt hash');
});

test('register rejects a duplicate email with a conflict', async () => {
  await request(app).post('/api/auth/register').send(VALID_USER).expect(201);

  const response = await request(app).post('/api/auth/register').send(VALID_USER);

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
});

test('register normalizes the email address', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, email: '  Ayesha@Example.COM  ' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.email, 'ayesha@example.com');
});

test('register rejects an invalid email address', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, email: 'not-an-email' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(response.body.error.details));
});

test('register rejects a short password', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, password: 'short' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('register rejects a missing name', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: VALID_USER.email, password: VALID_USER.password });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('login with correct credentials establishes a session', async () => {
  await request(app).post('/api/auth/register').send(VALID_USER).expect(201);

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: VALID_USER.email, password: VALID_USER.password });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.email, VALID_USER.email);
  assert.equal(response.body.data.user.password_hash, undefined);

  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(setCookie.some((cookie) => cookie.startsWith('glacier.sid=')));
});

test('login with a wrong password returns a generic 401 and no session', async () => {
  await request(app).post('/api/auth/register').send(VALID_USER).expect(201);

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: VALID_USER.email, password: 'the-wrong-password' });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  assert.equal(response.body.error.message, 'Invalid email or password');

  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(
    !setCookie.some((cookie) => cookie.startsWith('glacier.sid=')),
    'a failed login must not establish a session'
  );
});

test('login with an unknown email returns the same generic 401 as a wrong password', async () => {
  await request(app).post('/api/auth/register').send(VALID_USER).expect(201);

  const wrongPassword = await request(app)
    .post('/api/auth/login')
    .send({ email: VALID_USER.email, password: 'the-wrong-password' });

  const unknownEmail = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody@example.com', password: VALID_USER.password });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
  assert.equal(unknownEmail.body.error.message, 'Invalid email or password');
});

test('authentication regenerates the session id so a pre-login session cannot be reused', async () => {
  const agent = request.agent(app);

  const registered = await agent.post('/api/auth/register').send(VALID_USER);
  const firstSessionId = sessionIdFrom(registered.headers['set-cookie']);

  const loggedIn = await agent
    .post('/api/auth/login')
    .send({ email: VALID_USER.email, password: VALID_USER.password });
  const secondSessionId = sessionIdFrom(loggedIn.headers['set-cookie']);

  assert.ok(firstSessionId, 'expected a session cookie after registration');
  assert.ok(secondSessionId, 'expected a session cookie after login');
  assert.notEqual(
    secondSessionId,
    firstSessionId,
    'the session id must be regenerated on authentication'
  );
});

test('the current-user endpoint rejects a request without a session', async () => {
  const response = await request(app).get('/api/auth/me');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('the current-user endpoint returns the authenticated user', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(VALID_USER).expect(201);

  const response = await agent.get('/api/auth/me');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.email, VALID_USER.email);
  assert.equal(response.body.data.user.password_hash, undefined);
});

test('the session survives across requests on the same agent', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(VALID_USER).expect(201);

  const first = await agent.get('/api/auth/me');
  const second = await agent.get('/api/auth/me');

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
});

test('logout destroys the session so later protected requests are rejected', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(VALID_USER).expect(201);
  await agent.get('/api/auth/me').expect(200);

  const logout = await agent.post('/api/auth/logout');
  assert.equal(logout.status, 204);

  const after = await agent.get('/api/auth/me');
  assert.equal(after.status, 401);
});

test('logout without a session is rejected', async () => {
  const response = await request(app).post('/api/auth/logout');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('a state-changing request from a foreign origin is rejected', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', 'https://evil.example.com')
    .send(VALID_USER);

  assert.equal(response.status, 403);
  assert.ok(
    ['CORS_DENIED', 'FORBIDDEN'].includes(response.body.error.code),
    `unexpected error code: ${response.body.error.code}`
  );
});

test('the CSRF origin check rejects a foreign origin on its own', async () => {
  const foreign = {
    method: 'POST',
    get: (header) => (header === 'origin' ? 'https://evil.example.com' : undefined),
  };
  const trusted = {
    method: 'POST',
    get: (header) => (header === 'origin' ? 'http://localhost:5173' : undefined),
  };
  const read = { method: 'GET', get: () => undefined };

  const foreignError = await new Promise((resolve) => {
    verifyOrigin(foreign, {}, (error) => resolve(error));
  });
  assert.ok(foreignError, 'expected the foreign origin to be rejected');
  assert.equal(foreignError.statusCode, 403);
  assert.equal(foreignError.code, 'FORBIDDEN');

  const trustedError = await new Promise((resolve) => {
    verifyOrigin(trusted, {}, (error) => resolve(error));
  });
  assert.equal(trustedError, undefined, 'expected the trusted origin to pass');

  const readError = await new Promise((resolve) => {
    verifyOrigin(read, {}, (error) => resolve(error));
  });
  assert.equal(readError, undefined, 'expected a read request to pass');
});

test('a state-changing request from the trusted origin is accepted', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send(VALID_USER);

  assert.equal(response.status, 201);
});

test('SQL-like input is stored as data and does not alter the query', async () => {
  const hostile = "'; DROP TABLE users; --";

  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, name: hostile });

  assert.equal(response.status, 201);

  const { rows } = await query('SELECT name FROM users WHERE email = $1', [VALID_USER.email]);
  assert.equal(rows.length, 1, 'the users table must still exist and hold the new row');
  assert.equal(rows[0].name, hostile, 'the hostile value must be stored verbatim');

  const counts = await query('SELECT count(*)::int AS total FROM users');
  assert.equal(counts.rows[0].total, 1);
});

test('a malformed JSON body is rejected as a bad request, not a server error', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send('{name: not valid json}');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
});

test('an unknown route returns a 404 in the shared error shape', async () => {
  const response = await request(app).get('/api/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
