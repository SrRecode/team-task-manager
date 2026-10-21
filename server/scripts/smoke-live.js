'use strict';

/**
 * Live smoke test against a DEPLOYED application.
 *
 * It runs the whole flow of the assessment against the public addresses and
 * checks the status codes, the session cookie and the filters:
 *
 *   register -> logout -> 401 -> login -> team -> member -> task
 *   -> filter by team, assignee, status and search term -> update -> logout
 *
 * Usage (from the `server` directory):
 *
 *   $env:SMOKE_APP = 'https://PROJECT_ID.web.app'
 *   $env:SMOKE_API = 'https://THE_ADDRESS_OF_THE_API/api'
 *   node scripts/smoke-live.js
 *
 * `SMOKE_API` may be left out when the API is served on the same origin as the
 * application. Every request carries the `Origin` of the application, so the
 * CORS and the CSRF check of the server are part of the test.
 *
 * The script creates two users and one team in the database it tests. Point it
 * at a test database, not at a production one.
 */

const APP = process.env.SMOKE_APP || 'https://glacier-team-task-manager.web.app';
const API = process.env.SMOKE_API || `${APP}/api`;
const ORIGIN = new URL(APP).origin;
const stamp = Date.now();
const userA = { name: 'Smoke Owner', email: `smoke.owner.${stamp}@example.com`, password: 'SmokeTest123!' };
const userB = { name: 'Smoke Member', email: `smoke.member.${stamp}@example.com`, password: 'SmokeTest123!' };

let failures = 0;

function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` :: ${detail}` : ''}`);
}

/**
 * A session with its own cookie jar, so the two users do not share a session.
 */
function makeClient() {
  const jar = new Map();

  async function request(method, path, body) {
    const headers = { Origin: ORIGIN, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (jar.size > 0) {
      headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    const url = `${API}${path.replace(/^\/api/, '')}`;

    // A tunnel runs over a home connection, so a request can fail on the
    // transport. The retry keeps a network hiccup from looking like a broken
    // application.
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        response = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'manual',
          signal: AbortSignal.timeout(30000),
        });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    if (lastError) throw lastError;

    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /expires=thu, 01 jan 1970/i.test(raw)) jar.delete(name);
      else jar.set(name, value);
    }

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    return { status: response.status, body: payload, headers: response.headers };
  }

  return { request, jar };
}

(async () => {
  console.log(`Live smoke test\n  application: ${APP}\n  api:         ${API}\n`);

  // 1. The deployed frontend is served.
  const page = await fetch(APP, { headers: { Accept: 'text/html' } });
  const html = await page.text();
  check('deployed frontend responds with HTML', page.status === 200 && html.includes('<div id="root">'), `status=${page.status}`);

  const a = makeClient();

  // 2. Register the first user.
  const regA = await a.request('POST', '/api/auth/register', userA);
  check('register owner', regA.status === 201 || regA.status === 200, `status=${regA.status} body=${JSON.stringify(regA.body)}`);
  const ownerId = regA.body?.data?.user?.id ?? regA.body?.user?.id;

  // 3. Register the second user (in a separate session).
  const b = makeClient();
  const regB = await b.request('POST', '/api/auth/register', userB);
  check('register member', regB.status === 201 || regB.status === 200, `status=${regB.status} body=${JSON.stringify(regB.body)}`);
  const memberId = regB.body?.data?.user?.id ?? regB.body?.user?.id;

  // 4. The session cookie is stored and is HttpOnly + Secure.
  const cookieHeader = regA.headers.getSetCookie?.().join(';') ?? '';
  check('session cookie is HttpOnly', /HttpOnly/i.test(cookieHeader), cookieHeader);
  check('session cookie is Secure', /Secure/i.test(cookieHeader), cookieHeader);
  check('session cookie is SameSite=None', /SameSite=None/i.test(cookieHeader), cookieHeader);

  // 5. Log out, then log in again.
  const out1 = await a.request('POST', '/api/auth/logout');
  check('logout', out1.status === 200 || out1.status === 204, `status=${out1.status}`);

  const meAfterLogout = await a.request('GET', '/api/auth/me');
  check('protected route is 401 after logout', meAfterLogout.status === 401, `status=${meAfterLogout.status}`);

  const login = await a.request('POST', '/api/auth/login', { email: userA.email, password: userA.password });
  check('login', login.status === 200, `status=${login.status} body=${JSON.stringify(login.body)}`);

  const me = await a.request('GET', '/api/auth/me');
  check('session restored after login', me.status === 200, `status=${me.status}`);

  // 6. Create a team.
  const team = await a.request('POST', '/api/teams', { name: `Smoke Team ${stamp}`, description: 'Live smoke test' });
  check('create team', team.status === 201 || team.status === 200, `status=${team.status} body=${JSON.stringify(team.body)}`);
  const teamId = team.body?.data?.team?.id ?? team.body?.team?.id;

  // 7. Add the second user to the team.
  const addMember = await a.request('POST', `/api/teams/${teamId}/members`, { email: userB.email });
  check('add member to team', addMember.status === 201 || addMember.status === 200, `status=${addMember.status} body=${JSON.stringify(addMember.body)}`);

  const members = await a.request('GET', `/api/teams/${teamId}/members`);
  const memberList = members.body?.data?.members ?? members.body?.members ?? [];
  check('team has 2 members', memberList.length === 2, `count=${memberList.length}`);

  // 8. Create a task and assign it to the member.
  const task = await a.request('POST', '/api/tasks', {
    teamId,
    title: `Smoke Task ${stamp}`,
    description: 'Created by the live smoke test',
    status: 'todo',
    assignedTo: memberId,
    dueDate: '2026-12-31',
  });
  check('create task assigned to member', task.status === 201 || task.status === 200, `status=${task.status} body=${JSON.stringify(task.body)}`);
  const taskId = task.body?.data?.task?.id ?? task.body?.task?.id;

  // 9. Filter by team, by assignee and by status.
  const byTeam = await a.request('GET', `/api/tasks?teamId=${teamId}`);
  const teamTasks = byTeam.body?.data?.tasks ?? byTeam.body?.tasks ?? [];
  check('filter by team', teamTasks.length === 1 && teamTasks[0].id === taskId, `count=${teamTasks.length}`);

  const byAssignee = await a.request('GET', `/api/tasks?assigneeId=${memberId}`);
  const assigneeTasks = byAssignee.body?.data?.tasks ?? byAssignee.body?.tasks ?? [];
  check('filter by assignee', assigneeTasks.length === 1 && assigneeTasks[0].id === taskId, `count=${assigneeTasks.length}`);

  const byStatus = await a.request('GET', `/api/tasks?teamId=${teamId}&status=todo`);
  const statusTasks = byStatus.body?.data?.tasks ?? byStatus.body?.tasks ?? [];
  check('filter by status', statusTasks.length === 1, `count=${statusTasks.length}`);

  const bySearch = await a.request('GET', `/api/tasks?teamId=${teamId}&search=Smoke`);
  const searchTasks = bySearch.body?.data?.tasks ?? bySearch.body?.tasks ?? [];
  check('filter by search term', searchTasks.length === 1, `count=${searchTasks.length}`);

  const byOther = await a.request('GET', `/api/tasks?teamId=${teamId}&assigneeId=${ownerId}`);
  const otherTasks = byOther.body?.data?.tasks ?? byOther.body?.tasks ?? [];
  check('filter by other assignee is empty', otherTasks.length === 0, `count=${otherTasks.length}`);

  // 10. Update the task.
  const patch = await a.request('PATCH', `/api/tasks/${taskId}`, { status: 'in_progress', title: `Smoke Task ${stamp} updated` });
  check('update task', patch.status === 200, `status=${patch.status} body=${JSON.stringify(patch.body)}`);

  // 11. The member sees the task.
  const memberTasks = await b.request('GET', `/api/tasks?teamId=${teamId}`);
  const memberTaskList = memberTasks.body?.data?.tasks ?? memberTasks.body?.tasks ?? [];
  check('member sees the task', memberTaskList.length === 1, `count=${memberTaskList.length}`);

  // 12. Log out and confirm the session is gone.
  const out2 = await a.request('POST', '/api/auth/logout');
  check('logout again', out2.status === 200 || out2.status === 204, `status=${out2.status}`);

  const protectedAfter = await a.request('GET', '/api/teams');
  check('protected route is 401 after the final logout', protectedAfter.status === 401, `status=${protectedAfter.status}`);

  // 13. The database is reachable through the deployed path.
  const health = await fetch(`${API.replace(/\/api$/, '')}/health?database=true`).catch(() => null);
  const healthBody = health ? await health.json().catch(() => null) : null;
  check('health route reports the database up', health?.status === 200 && healthBody?.database === 'up', `status=${health?.status} body=${JSON.stringify(healthBody)}`);

  console.log(`\n${failures === 0 ? 'SMOKE TEST PASSED' : `SMOKE TEST FAILED (${failures} failed checks)`}`);
  console.log(`owner=${userA.email} member=${userB.email} teamId=${teamId} taskId=${taskId}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error('SMOKE TEST ERROR', error);
  process.exit(1);
});
