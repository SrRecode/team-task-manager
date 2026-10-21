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

const INVITEE = {
  name: 'Chandni Roy',
  email: 'invitee@example.com',
  password: 'a-long-user-chosen-password',
};

async function registerUser(user) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send(user);
  assert.equal(response.status, 201);
  return { agent, body: response.body };
}

async function createTeam(agent, name = 'Assessment Team') {
  const response = await agent.post('/api/teams').send({ name, description: 'Team task planning' });
  assert.equal(response.status, 201);
  return response.body.data.team;
}

async function addMember(owner, teamId, email) {
  await owner.post(`/api/teams/${teamId}/members`).send({ email }).expect(201);
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

test('the owner can invite an address that has no account yet', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner
    .post(`/api/teams/${team.id}/invites`)
    .send({ email: INVITEE.email });

  assert.equal(response.status, 201);

  const { invite } = response.body.data;
  assert.equal(invite.email, INVITEE.email);
  assert.equal(invite.teamId, team.id);
  assert.equal(invite.status, 'pending');
  assert.equal(invite.delivery, 'stub');
  assert.equal(invite.notificationSent, false);
});

test('an invalid email address is rejected', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);

  const response = await owner.post(`/api/teams/${team.id}/invites`).send({ email: 'not-an-email' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('a member cannot invite somebody', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const { agent: member } = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const response = await member.post(`/api/teams/${team.id}/invites`).send({ email: INVITEE.email });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('a team the caller does not belong to is not reachable', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const { agent: outsider } = await registerUser(INVITEE);
  const team = await createTeam(owner);

  const response = await outsider
    .post(`/api/teams/${team.id}/invites`)
    .send({ email: INVITEE.email });

  assert.equal(response.status, 404);
});

test('the same address cannot be invited twice', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);

  await owner.post(`/api/teams/${team.id}/invites`).send({ email: INVITEE.email }).expect(201);

  const response = await owner
    .post(`/api/teams/${team.id}/invites`)
    .send({ email: INVITEE.email });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
});

test('a current member cannot be invited', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const { agent: member } = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  const response = await owner.post(`/api/teams/${team.id}/invites`).send({ email: MEMBER.email });

  assert.equal(response.status, 409);
});

test('the invited address becomes a member when it registers', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);
  await owner.post(`/api/teams/${team.id}/invites`).send({ email: INVITEE.email }).expect(201);

  const { body } = await registerUser(INVITEE);

  assert.equal(body.data.acceptedInvites.length, 1);
  assert.equal(body.data.acceptedInvites[0].teamId, team.id);
  assert.equal(body.data.acceptedInvites[0].status, 'accepted');

  const members = await owner.get(`/api/teams/${team.id}/members`).expect(200);
  const emails = members.body.data.members.map((member) => member.email);
  assert.ok(emails.includes(INVITEE.email));

  const { rows } = await query(
    'SELECT status FROM team_invites WHERE email = $1',
    [INVITEE.email]
  );
  assert.equal(rows[0].status, 'accepted');
});

test('a pending invitation is accepted when the address signs in', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const { agent: invitee } = await registerUser(INVITEE);
  const team = await createTeam(owner);

  await owner.post(`/api/teams/${team.id}/invites`).send({ email: INVITEE.email }).expect(201);

  const response = await invitee
    .post('/api/auth/login')
    .send({ email: INVITEE.email, password: INVITEE.password });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.acceptedInvites.length, 1);
  assert.equal(response.body.data.acceptedInvites[0].teamId, team.id);
});

test('the invitations of a team are listed for its members', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const { agent: member } = await registerUser(MEMBER);
  const team = await createTeam(owner);
  await addMember(owner, team.id, MEMBER.email);

  await owner.post(`/api/teams/${team.id}/invites`).send({ email: INVITEE.email }).expect(201);

  const response = await member.get(`/api/teams/${team.id}/invites`).expect(200);

  assert.equal(response.body.data.invites.length, 1);
  assert.equal(response.body.data.invites[0].email, INVITEE.email);
  assert.equal(response.body.data.invites[0].status, 'pending');
});

test('the owner can revoke a pending invitation', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);

  const created = await owner
    .post(`/api/teams/${team.id}/invites`)
    .send({ email: INVITEE.email })
    .expect(201);

  const inviteId = created.body.data.invite.id;

  await owner.delete(`/api/teams/${team.id}/invites/${inviteId}`).expect(204);

  const response = await owner.get(`/api/teams/${team.id}/invites`).expect(200);

  const pending = response.body.data.invites.filter((invite) => invite.status === 'pending');
  assert.equal(pending.length, 0);

  const { rows } = await query('SELECT status FROM team_invites WHERE id = $1', [inviteId]);
  assert.equal(rows[0].status, 'revoked');
});

test('every invite route rejects an unauthenticated request', async () => {
  const { agent: owner } = await registerUser(OWNER);
  const team = await createTeam(owner);
  const created = await owner
    .post(`/api/teams/${team.id}/invites`)
    .send({ email: INVITEE.email })
    .expect(201);

  const anonymous = request(app);

  await anonymous.get(`/api/teams/${team.id}/invites`).expect(401);
  await anonymous.post(`/api/teams/${team.id}/invites`).send({ email: 'x@example.com' }).expect(401);
  await anonymous.delete(`/api/teams/${team.id}/invites/${created.body.data.invite.id}`).expect(401);
});
