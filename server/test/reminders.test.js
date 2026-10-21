'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { prepareDatabase, closeDatabase } = require('../test-support/database');
const { createApp } = require('../src/app');
const { query } = require('../src/config/database');

const app = createApp();

const OWNER = {
  name: 'Ayesha Khan',
  email: 'owner@example.com',
  password: 'a-long-user-chosen-password',
};

const MEMBER = {
  name: 'Bilal Ahmed',
  email: 'member@example.com',
  password: 'a-long-user-chosen-password',
};

async function registerUser(user) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(user).expect(201);
  return agent;
}

async function createTeam(agent, name = 'Assessment Team') {
  const response = await agent.post('/api/teams').send({ name, description: 'Team task planning' });
  assert.equal(response.status, 201);
  return response.body.data.team;
}

async function userIdByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0].id;
}

/**
 * The current date of the database, so the test and the API always agree on
 * what "today" is.
 */
async function today() {
  const { rows } = await query('SELECT CURRENT_DATE::text AS today');
  return rows[0].today;
}

function addDays(date, days) {
  const copy = new Date(`${date}T00:00:00Z`);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

async function createTask(agent, payload) {
  const response = await agent.post('/api/tasks').send(payload);
  assert.equal(response.status, 201);
  return response.body.data.task;
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

test('a task that is due soon is a reminder of the assignee', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Write the release notes',
    assignedTo: memberId,
    dueDate: addDays(currentDate, 2),
  });

  const response = await member.get('/api/reminders').expect(200);

  const { reminders, counts } = response.body.data.reminders;
  assert.equal(counts.total, 1);
  assert.equal(reminders.upcoming.length, 1);
  assert.equal(reminders.upcoming[0].title, 'Write the release notes');
  assert.equal(reminders.upcoming[0].teamName, team.name);
});

test('an overdue task is reported as overdue', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Overdue task',
    assignedTo: memberId,
    dueDate: addDays(currentDate, -3),
  });

  const response = await member.get('/api/reminders').expect(200);

  const { reminders, counts } = response.body.data.reminders;
  assert.equal(counts.overdue, 1);
  assert.equal(reminders.overdue.length, 1);
  assert.equal(reminders.overdue[0].title, 'Overdue task');
});

test('a task that is due today is reported in its own group', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Due today',
    assignedTo: memberId,
    dueDate: currentDate,
  });

  const response = await member.get('/api/reminders').expect(200);

  const { reminders } = response.body.data.reminders;
  assert.equal(reminders.today.length, 1);
  assert.equal(reminders.today[0].title, 'Due today');
});

test('a finished task is not a reminder', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Finished task',
    assignedTo: memberId,
    status: 'done',
    dueDate: addDays(currentDate, 1),
  });

  const response = await member.get('/api/reminders').expect(200);

  assert.equal(response.body.data.reminders.counts.total, 0);
});

test('a task without a due date is not a reminder', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);

  await createTask(owner, {
    teamId: team.id,
    title: 'No due date',
    assignedTo: memberId,
  });

  const response = await member.get('/api/reminders').expect(200);

  assert.equal(response.body.data.reminders.counts.total, 0);
});

test('a task that is due far ahead is not a reminder', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Far ahead',
    assignedTo: memberId,
    dueDate: addDays(currentDate, 40),
  });

  const response = await member.get('/api/reminders').expect(200);

  assert.equal(response.body.data.reminders.counts.total, 0);
});

test('a task of somebody else is not a reminder', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const ownerId = await userIdByEmail(OWNER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: team.id,
    title: 'Owner task',
    assignedTo: ownerId,
    dueDate: addDays(currentDate, 1),
  });

  const response = await member.get('/api/reminders').expect(200);

  assert.equal(response.body.data.reminders.counts.total, 0);
});

test('a task of a team the caller left is not a reminder', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const otherTeam = await createTeam(owner, 'Other team');
  await owner.post(`/api/teams/${otherTeam.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const currentDate = await today();

  await createTask(owner, {
    teamId: otherTeam.id,
    title: 'Other team task',
    assignedTo: memberId,
    dueDate: addDays(currentDate, 1),
  });

  const before = await member.get('/api/reminders').expect(200);
  assert.equal(before.body.data.reminders.counts.total, 1);

  // Leaving the team unassigns the task of that member.
  await member.delete(`/api/teams/${otherTeam.id}/members/${memberId}`).expect(204);

  const after = await member.get('/api/reminders').expect(200);
  assert.equal(after.body.data.reminders.counts.total, 0);
});

test('the reminders route rejects an unauthenticated request', async () => {
  await request(app).get('/api/reminders').expect(401);
});
