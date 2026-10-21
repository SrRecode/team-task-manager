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

test.before(async () => {
  await prepareDatabase();
});

test.after(async () => {
  await closeDatabase();
});

test.beforeEach(async () => {
  await prepareDatabase();
});

test('creating a team makes the caller its owner', async () => {
  const agent = await registerUser(OWNER);

  const response = await agent
    .post('/api/teams')
    .send({ name: 'Assessment Team', description: 'Team task planning' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.team.name, 'Assessment Team');
  assert.equal(response.body.data.team.description, 'Team task planning');
  assert.equal(response.body.data.team.currentUserRole, 'owner');
  assert.ok(response.body.data.team.id);
});

test('creating a team writes the team and the owner membership atomically', async () => {
  const agent = await registerUser(OWNER);
  const team = await createTeam(agent);

  const { rows } = await query(
    'SELECT role FROM team_members WHERE team_id = $1',
    [team.id]
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, 'owner');
});

test('the team list contains only the teams the caller belongs to', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);

  await createTeam(owner, 'Team Alpha');
  await createTeam(owner, 'Team Beta');
  await createTeam(outsider, 'Team Gamma');

  const response = await owner.get('/api/teams');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.teams.length, 2);
  assert.deepEqual(
    response.body.data.teams.map((team) => team.name).sort(),
    ['Team Alpha', 'Team Beta']
  );
});

test('a member sees the team in their list with the member role', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const response = await member.get('/api/teams');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.teams.length, 1);
  assert.equal(response.body.data.teams[0].currentUserRole, 'member');
});

test('a member can read the team and its member list', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const teamResponse = await member.get(`/api/teams/${team.id}`);
  assert.equal(teamResponse.status, 200);
  assert.equal(teamResponse.body.data.team.id, team.id);

  const membersResponse = await member.get(`/api/teams/${team.id}/members`);
  assert.equal(membersResponse.status, 200);
  assert.equal(membersResponse.body.data.members.length, 2);
});

test('a team the caller does not belong to is reported as 404, not 403', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);

  const team = await createTeam(owner);

  const response = await outsider.get(`/api/teams/${team.id}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('the owner can update the team', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner
    .patch(`/api/teams/${team.id}`)
    .send({ name: 'Renamed Team', description: 'A new description' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.team.name, 'Renamed Team');
  assert.equal(response.body.data.team.description, 'A new description');
});

test('a member cannot update the team', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const response = await member.patch(`/api/teams/${team.id}`).send({ name: 'Hijacked' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('the owner can delete the team', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner.delete(`/api/teams/${team.id}`);

  assert.equal(response.status, 204);

  const { rows } = await query('SELECT count(*)::int AS total FROM teams WHERE id = $1', [team.id]);
  assert.equal(rows[0].total, 0);
});

test('a member cannot delete the team', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const response = await member.delete(`/api/teams/${team.id}`);

  assert.equal(response.status, 403);

  const { rows } = await query('SELECT count(*)::int AS total FROM teams WHERE id = $1', [team.id]);
  assert.equal(rows[0].total, 1, 'the team must still exist');
});

test('the owner can add a registered user to the team', async () => {
  const owner = await registerUser(OWNER);
  await registerUser(MEMBER);

  const team = await createTeam(owner);

  const response = await owner
    .post(`/api/teams/${team.id}/members`)
    .send({ email: MEMBER.email });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.member.email, MEMBER.email);
  assert.equal(response.body.data.member.role, 'member');
});

test('the email used to add a member is matched after normalisation', async () => {
  const owner = await registerUser(OWNER);
  await registerUser(MEMBER);

  const team = await createTeam(owner);

  const response = await owner
    .post(`/api/teams/${team.id}/members`)
    .send({ email: '  Member@Example.COM  ' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.member.email, MEMBER.email);
});

test('adding a user who is not registered is rejected', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner
    .post(`/api/teams/${team.id}/members`)
    .send({ email: 'nobody@example.com' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('adding the same user twice is a conflict', async () => {
  const owner = await registerUser(OWNER);
  await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const response = await owner
    .post(`/api/teams/${team.id}/members`)
    .send({ email: MEMBER.email });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
});

test('a member cannot add another member', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  await registerUser(OUTSIDER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const response = await member
    .post(`/api/teams/${team.id}/members`)
    .send({ email: OUTSIDER.email });

  assert.equal(response.status, 403);
});

test('the owner can remove a member', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const response = await owner.delete(`/api/teams/${team.id}/members/${memberId}`);

  assert.equal(response.status, 204);

  const members = await owner.get(`/api/teams/${team.id}/members`);
  assert.equal(members.body.data.members.length, 1);
});

test('a member can leave the team by removing themselves', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);

  const memberId = await userIdByEmail(MEMBER.email);
  const response = await member.delete(`/api/teams/${team.id}/members/${memberId}`);

  assert.equal(response.status, 204);

  const list = await member.get('/api/teams');
  assert.equal(list.body.data.teams.length, 0);
});

test('the owner cannot leave the team and orphan it', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const ownerId = await userIdByEmail(OWNER.email);
  const response = await owner.delete(`/api/teams/${team.id}/members/${ownerId}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');

  const { rows } = await query(
    'SELECT count(*)::int AS total FROM team_members WHERE team_id = $1',
    [team.id]
  );
  assert.equal(rows[0].total, 1, 'the owner must still be a member of the team');
});

test('a member cannot remove somebody else', async () => {
  const owner = await registerUser(OWNER);
  const member = await registerUser(MEMBER);
  await registerUser(OUTSIDER);

  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }).expect(201);
  await owner.post(`/api/teams/${team.id}/members`).send({ email: OUTSIDER.email }).expect(201);

  const outsiderId = await userIdByEmail(OUTSIDER.email);
  const response = await member.delete(`/api/teams/${team.id}/members/${outsiderId}`);

  assert.equal(response.status, 403);
});

test('a non-member cannot read the member list', async () => {
  const owner = await registerUser(OWNER);
  const outsider = await registerUser(OUTSIDER);

  const team = await createTeam(owner);

  const response = await outsider.get(`/api/teams/${team.id}/members`);

  assert.equal(response.status, 404);
});

test('every team route rejects an unauthenticated request', async () => {
  const owner = await registerUser(OWNER);
  const team = await createTeam(owner);

  const calls = [
    request(app).get('/api/teams'),
    request(app).post('/api/teams').send({ name: 'Anonymous' }),
    request(app).get(`/api/teams/${team.id}`),
    request(app).patch(`/api/teams/${team.id}`).send({ name: 'Anonymous' }),
    request(app).delete(`/api/teams/${team.id}`),
    request(app).get(`/api/teams/${team.id}/members`),
    request(app).post(`/api/teams/${team.id}/members`).send({ email: MEMBER.email }),
  ];

  for (const call of calls) {
    const response = await call;
    assert.equal(response.status, 401, 'expected 401 for an unauthenticated request');
  }
});

test('an invalid team id is rejected as a validation error', async () => {
  const agent = await registerUser(OWNER);

  const response = await agent.get('/api/teams/not-a-number');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('a team name is required and bounded', async () => {
  const agent = await registerUser(OWNER);

  const missing = await agent.post('/api/teams').send({ description: 'No name at all' });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'VALIDATION_ERROR');

  const empty = await agent.post('/api/teams').send({ name: '   ' });
  assert.equal(empty.status, 400);

  const tooLong = await agent.post('/api/teams').send({ name: 'x'.repeat(121) });
  assert.equal(tooLong.status, 400);
});

test('the creator identity comes from the session, not from the request body', async () => {
  const agent = await registerUser(OWNER);

  const response = await agent
    .post('/api/teams')
    .send({ name: 'Assessment Team', createdBy: 999999, userId: 999999 });

  assert.equal(response.status, 201);

  const { rows } = await query('SELECT created_by FROM teams WHERE id = $1', [
    response.body.data.team.id,
  ]);
  assert.equal(rows[0].created_by, (await userIdByEmail(OWNER.email)));
});

test('ids are returned as numbers, not as strings', async () => {
  const agent = await registerUser(OWNER);

  const teamResponse = await agent.post('/api/teams').send({ name: 'Type Check' });
  assert.equal(typeof teamResponse.body.data.team.id, 'number');

  const membersResponse = await agent.get(
    `/api/teams/${teamResponse.body.data.team.id}/members`
  );
  assert.equal(typeof membersResponse.body.data.members[0].userId, 'number');
});

async function userIdByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0].id;
}
