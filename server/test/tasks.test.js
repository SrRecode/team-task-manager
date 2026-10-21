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

const OUTSIDER = {
  name: 'Chandni Roy',
  email: 'outsider@example.com',
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

async function addMember(owner, teamId, email) {
  await owner.post(`/api/teams/${teamId}/members`).send({ email }).expect(201);
}

async function userIdByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0].id;
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

test('creating a task in a team the caller belongs to', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const task = await createTask(owner, {
    teamId: team.id,
    title: 'Review pull request',
    description: 'Check the API tests',
    status: 'todo',
  });

  assert.equal(task.title, 'Review pull request');
  assert.equal(task.description, 'Check the API tests');
  assert.equal(task.teamId, team.id);
  assert.equal(task.status, 'todo');
  assert.equal(task.assignedTo, null);
  assert.equal(task.createdBy, await userIdByEmail(OWNER.email));
});

test('the creator identity comes from the session, not from the request body', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Session identity', createdBy: 999999 });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.task.createdBy, await userIdByEmail(OWNER.email));
});

test('a task can be assigned to a member of the same team', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const memberId = await userIdByEmail(MEMBER.email);
  const task = await createTask(owner, {
    teamId: team.id,
    title: 'Assigned task',
    assignedTo: memberId,
  });

  assert.equal(task.assignedTo, memberId);
  assert.equal(task.assignedToName, MEMBER.name);
});

test('a task cannot be assigned to a user outside the team', async () => {
  const owner = await registerUser(OWNER);
  await registerUser(OUTSIDER);
  const team = await createTeam(owner);

  const outsiderId = await userIdByEmail(OUTSIDER.email);
  const response = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Invalid assignment', assignedTo: outsiderId });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('a task cannot be created in a team the caller does not belong to', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);
  const team = await createTeam(owner);

  const response = await outsider
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Not my team' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('a task needs a title, a known team and a valid status', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const noTitle = await owner.post('/api/tasks').send({ teamId: team.id });
  assert.equal(noTitle.status, 400);

  const longTitle = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'x'.repeat(201) });
  assert.equal(longTitle.status, 400);

  const badStatus = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Bad status', status: 'archived' });
  assert.equal(badStatus.status, 400);

  const badTeam = await owner.post('/api/tasks').send({ teamId: 'abc', title: 'Bad team' });
  assert.equal(badTeam.status, 400);
});

test('a due date must be a real calendar date', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const wrongFormat = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Due date', dueDate: '31/12/2026' });
  assert.equal(wrongFormat.status, 400);

  const notADate = await owner
    .post('/api/tasks')
    .send({ teamId: team.id, title: 'Due date', dueDate: '2026-02-31' });
  assert.equal(notADate.status, 400);

  const valid = await createTask(owner, {
    teamId: team.id,
    title: 'Due date',
    dueDate: '2026-12-31',
  });
  assert.equal(valid.dueDate, '2026-12-31');
});

test('the task list only contains the tasks of the teams the caller belongs to', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);

  const team = await createTeam(owner, 'Team Alpha');
  const otherTeam = await createTeam(outsider, 'Team Gamma');

  await createTask(owner, { teamId: team.id, title: 'Visible task' });
  await createTask(outsider, { teamId: otherTeam.id, title: 'Hidden task' });

  const response = await owner.get('/api/tasks');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.tasks.length, 1);
  assert.equal(response.body.data.tasks[0].title, 'Visible task');
});

test('tasks can be filtered by team, assignee, status and search term', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner, 'Team Alpha');
  const secondTeam = await createTeam(owner, 'Team Beta');
  await addMember(owner, team.id, MEMBER.email);

  const memberId = await userIdByEmail(MEMBER.email);

  await createTask(owner, {
    teamId: team.id,
    title: 'Review pull request',
    description: 'Check the API tests',
    assignedTo: memberId,
    status: 'todo',
  });
  await createTask(owner, {
    teamId: team.id,
    title: 'Write the summary',
    status: 'done',
  });
  await createTask(owner, {
    teamId: secondTeam.id,
    title: 'Review the deployment plan',
    status: 'todo',
  });

  const byTeam = await owner.get(`/api/tasks?teamId=${team.id}`);
  assert.equal(byTeam.body.data.tasks.length, 2);

  const byAssignee = await owner.get(`/api/tasks?assigneeId=${memberId}`);
  assert.equal(byAssignee.body.data.tasks.length, 1);
  assert.equal(byAssignee.body.data.tasks[0].title, 'Review pull request');

  const byStatus = await owner.get('/api/tasks?status=done');
  assert.equal(byStatus.body.data.tasks.length, 1);
  assert.equal(byStatus.body.data.tasks[0].title, 'Write the summary');

  const bySearch = await owner.get('/api/tasks?search=deployment');
  assert.equal(bySearch.body.data.tasks.length, 1);
  assert.equal(bySearch.body.data.tasks[0].title, 'Review the deployment plan');

  const byDescription = await owner.get('/api/tasks?search=API tests');
  assert.equal(byDescription.body.data.tasks.length, 1);
  assert.equal(byDescription.body.data.tasks[0].title, 'Review pull request');
});

test('the team and assignee filters combine', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner, 'Team Alpha');
  const secondTeam = await createTeam(owner, 'Team Beta');
  await addMember(owner, team.id, MEMBER.email);
  await addMember(owner, secondTeam.id, MEMBER.email);

  const memberId = await userIdByEmail(MEMBER.email);

  await createTask(owner, {
    teamId: team.id,
    title: 'First',
    assignedTo: memberId,
  });
  await createTask(owner, {
    teamId: secondTeam.id,
    title: 'Second',
    assignedTo: memberId,
  });

  const response = await owner.get(`/api/tasks?teamId=${team.id}&assigneeId=${memberId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.tasks.length, 1);
  assert.equal(response.body.data.tasks[0].title, 'First');
});

test('a task of another team is reported as 404, not 403', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);
  const team = await createTeam(owner);

  const task = await createTask(owner, { teamId: team.id, title: 'Private task' });

  const response = await outsider.get(`/api/tasks/${task.id}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('a member who did not create the task cannot change it', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const task = await createTask(owner, { teamId: team.id, title: 'Owner task' });

  const update = await member.patch(`/api/tasks/${task.id}`).send({ title: 'Hijacked' });
  assert.equal(update.status, 403);
  assert.equal(update.body.error.code, 'FORBIDDEN');

  const remove = await member.delete(`/api/tasks/${task.id}`);
  assert.equal(remove.status, 403);
});

test('the creator of a task can update it', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const task = await createTask(member, { teamId: team.id, title: 'Member task' });

  const response = await member
    .patch(`/api/tasks/${task.id}`)
    .send({ title: 'Member task updated', status: 'in_progress' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.task.title, 'Member task updated');
  assert.equal(response.body.data.task.status, 'in_progress');
});

test('the team owner can update and delete a task of a member', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const task = await createTask(member, { teamId: team.id, title: 'Member task' });

  const update = await owner.patch(`/api/tasks/${task.id}`).send({ status: 'done' });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.task.status, 'done');

  const remove = await owner.delete(`/api/tasks/${task.id}`);
  assert.equal(remove.status, 204);

  const { rows } = await query('SELECT count(*)::int AS total FROM tasks WHERE id = $1', [
    task.id,
  ]);
  assert.equal(rows[0].total, 0);
});

test('a task can be unassigned and assigned to another member', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const memberId = await userIdByEmail(MEMBER.email);
  const task = await createTask(owner, {
    teamId: team.id,
    title: 'Assignee changes',
    assignedTo: memberId,
  });

  const unassigned = await owner.patch(`/api/tasks/${task.id}`).send({ assignedTo: null });
  assert.equal(unassigned.status, 200);
  assert.equal(unassigned.body.data.task.assignedTo, null);

  const reassigned = await owner
    .patch(`/api/tasks/${task.id}`)
    .send({ assignedTo: await userIdByEmail(OWNER.email) });
  assert.equal(reassigned.status, 200);
  assert.equal(reassigned.body.data.task.assignedTo, await userIdByEmail(OWNER.email));
});

test('a task cannot be moved to another team', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner, 'Team Alpha');
  const secondTeam = await createTeam(owner, 'Team Beta');
  const task = await createTask(owner, { teamId: team.id, title: 'Fixed team' });

  const response = await owner
    .patch(`/api/tasks/${task.id}`)
    .send({ teamId: secondTeam.id });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('removing a member from a team unassigns their tasks', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const memberId = await userIdByEmail(MEMBER.email);
  const task = await createTask(owner, {
    teamId: team.id,
    title: 'Assigned to the member',
    assignedTo: memberId,
  });

  const remove = await owner.delete(`/api/teams/${team.id}/members/${memberId}`);
  assert.equal(remove.status, 204);

  const { rows } = await query('SELECT assigned_to FROM tasks WHERE id = $1', [task.id]);
  assert.equal(rows[0].assigned_to, null, 'the task must stay in the team and become unassigned');
});

test('every task route rejects an unauthenticated request', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);
  const task = await createTask(owner, { teamId: team.id, title: 'Protected' });

  const calls = [
    request(app).get('/api/tasks'),
    request(app).post('/api/tasks').send({ teamId: team.id, title: 'Anonymous' }),
    request(app).get(`/api/tasks/${task.id}`),
    request(app).patch(`/api/tasks/${task.id}`).send({ title: 'Anonymous' }),
    request(app).delete(`/api/tasks/${task.id}`),
  ];

  for (const call of calls) {
    const response = await call;
    assert.equal(response.status, 401, 'expected 401 for an unauthenticated request');
  }
});

test('an invalid task id is rejected as a validation error', async () => {
  const owner = await registerUser(OWNER);

  const response = await owner.get('/api/tasks/not-a-number');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('an invalid filter is rejected as a validation error', async () => {
  const owner = await registerUser(OWNER);

  const badStatus = await owner.get('/api/tasks?status=archived');
  assert.equal(badStatus.status, 400);

  const badTeam = await owner.get('/api/tasks?teamId=abc');
  assert.equal(badTeam.status, 400);
});

test('ids are returned as numbers, not as strings', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const task = await createTask(owner, { teamId: team.id, title: 'Type check' });
  assert.equal(typeof task.id, 'number');
  assert.equal(typeof task.teamId, 'number');
  assert.equal(typeof task.createdBy, 'number');
});
