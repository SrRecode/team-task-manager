# Testing and Quality Assurance

## 1. Goals

Test required behavior, integration, authorization and the production deployment. A passing happy-path demo is not sufficient for session-based security.

## 2. Test layers

- **Unit tests:** validation helpers and domain logic where useful.
- **API/integration tests:** Express routes with a test database or isolated test setup; Supertest can exercise HTTP behavior.
- **Frontend tests:** form validation and key UI behavior with the project's selected React test tools.
- **Manual end-to-end tests:** browser workflows against local and deployed environments.

Use tools already configured in the repository where possible. Do not add a large test stack if it jeopardizes the deadline.

## 3. Critical test matrix

| Area | Scenario | Expected result |
|---|---|---|
| Register | Valid details | Account created; password hash stored |
| Register | Duplicate email | Clear conflict response |
| Register | Invalid email/short or invalid password | Validation error |
| Login | Correct credentials | Session established |
| Login | Incorrect credentials | Generic 401; no authenticated session |
| Session | Refresh browser after login | Session remains valid according to configuration |
| Logout | Valid session | Session destroyed; later protected request rejected |
| Auth | No session calls protected API | 401 |
| Team | Create team | Team and owner membership created atomically |
| Team | List teams | Only current user's memberships returned |
| Team | Non-owner deletes team | Denied |
| Membership | Add registered user | Membership created |
| Membership | Add duplicate membership | Conflict or idempotent documented response |
| Task | Create valid task | 201 and stored task |
| Task | Assign user outside team | Rejected |
| Task | Access task from unrelated team | Denied or concealed |
| Task | Invalid status | 400 |
| Task | Update/delete without permission | Denied |
| Filter | Team and assignee filters together | Correct accessible subset |
| Reminder | Task of the user is due today | Listed in the `today` group of the dashboard |
| Reminder | Task is finished or has no due date | Not a reminder |
| Reminder | Task of somebody else | Not a reminder |
| Invitation | Owner invites an unregistered address | 201 and a pending invitation, labelled as a stub |
| Invitation | Member tries to invite | Denied |
| Invitation | The invited address registers | The user becomes a member of the team |
| Invitation | The same address is invited twice | Conflict |
| SQL safety | Malicious-looking input | Treated as data, not SQL |
| Frontend | API fails | Clear error state |
| Frontend | No tasks | Useful empty state |
| Responsive | Mobile viewport | Controls remain usable |
| Deployment | Live register/login/task flow | End-to-end workflow succeeds |

## 4. Manual end-to-end test

Use at least two test users:
1. Register User A.
2. Register User B.
3. Log in as User A and create Team A.
4. Add User B to Team A.
5. Create a task assigned to User B.
6. Verify the task appears in Team A and filters work.
7. Attempt invalid assignment to a non-member; confirm rejection.
8. Create an unrelated team/user and verify cross-team access is denied.
9. Test edits, status updates and authorized deletion.
10. Log out and verify protected requests fail.
11. Repeat the main flow against the deployed URL.

### Bonus flows

Reminders (BONUS-01):

1. Sign in as User A, who has a task with a due date of today and one that is
   overdue.
2. Open the dashboard: both tasks are listed in the **Reminders** panel, in the
   `Due today` and `Overdue` groups.
3. Change the status of a task to `done` and confirm that it disappears from
   the panel.

Invitations (BONUS-03):

1. Sign in as User A, open Team A and record an invitation for an address that
   has no account.
2. Confirm that the invitation is listed as pending and that the notice says
   that no email was sent.
3. Register an account with that address: the user is a member of Team A and
   the app shows the notice that the team was joined because of the
   invitation.
4. Sign in as a member of Team A and confirm that recording an invitation is
   not possible.

Do not use real personal data or production credentials in test fixtures.

### What was verified on 21 October 2026

The workflow above was executed in a browser against the local stack
(PostgreSQL 18 on `localhost:5432`, the API on `http://localhost:5000`, the
client on `http://localhost:5173`).

| Step | Result |
|---|---|
| Register `asha.khan@glacier.test` | the account is created, the session starts, the dashboard opens |
| Create the team `Website Redesign` | the creator becomes the **owner**, the team and its member list are shown |
| Record the invitation for `omar.reza@glacier.test` | the invitation is listed as pending, the notice says that no mail was sent |
| Register `omar.reza@glacier.test` | the invitation is **accepted**, the user joins the team as a member |
| Add the same address as a member | the API answers `409 Conflict`, the user is a member already |
| Create the task `Rewrite the pricing page` | team, assignee, status and due date are stored and shown |
| Change the status to `In progress` and the assignee | the change is saved, the list and the filters follow |
| Filter by status `Done` | the list is empty, the notice "No task matches these filters" appears |
| Filter by the search term `pricing` | only the task is listed, another term empties the list |
| Reminders panel | "1 task of yours needs attention", the task is in the group `Coming up` |
| Sign out | the session cookie is gone and `GET /api/tasks` answers `401` |
| Sign in again | the dashboard, the team and the task are restored from the session |

The automated suites cover the same flows on the server:
`npm test` in `server` runs 90 tests (`auth`, `teams`, `tasks`, `invites`,
`reminders`).

### The live run of 21 October 2026

The same workflow was run against the **deployed** application,
<https://glacier-team-task-manager.web.app>, twice: once with an API script
against the public address of the API, once in a real browser (Chrome, headless)
against the deployed URL. The API was the local server in production mode, with
the PostgreSQL database `glacier_tasks` behind it, published through a
Cloudflare quick tunnel; the reason is in
[DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) § 0.0.

The API script (`server/scripts/smoke-live.js`) makes every request with the
`Origin` of the deployed frontend and keeps the session cookie of the answer.
Its result:

```text
[PASS] deployed frontend responds with HTML :: status=200
[PASS] register owner :: status=201
[PASS] register member :: status=201
[PASS] session cookie is HttpOnly
[PASS] session cookie is Secure
[PASS] session cookie is SameSite=None
[PASS] logout :: status=204
[PASS] protected route is 401 after logout :: status=401
[PASS] login :: status=200
[PASS] session restored after login :: status=200
[PASS] create team :: status=201
[PASS] add member to team :: status=201
[PASS] team has 2 members :: count=2
[PASS] create task assigned to member :: status=201
[PASS] filter by team :: count=1
[PASS] filter by assignee :: count=1
[PASS] filter by status :: count=1
[PASS] filter by search term :: count=1
[PASS] filter by other assignee is empty :: count=0
[PASS] update task :: status=200
[PASS] member sees the task :: count=1
[PASS] logout again :: status=204
[PASS] protected route is 401 after the final logout :: status=401
[PASS] health route reports the database up :: status=200 body={"status":"ok","database":"up"}

SMOKE TEST PASSED
```

The browser run, against the deployed URL:

| Step | Result |
|---|---|
| The deployed site opens | the sign-in screen, the console holds only the `401` of the session probe |
| Register `browser.smoke.1792598600@example.com` | the dashboard opens, the name is in the header |
| The cookie of the browser | `glacier.sid` on the API origin, `HttpOnly`, `Secure`, `SameSite=None` |
| Create the team `Browser Smoke Team` | the creator is the owner, the member list is shown |
| Create the task `Deployed smoke task` | team, assignee, status and due date are shown |
| Filter by team and by assignee | the task stays in the list |
| Filter by status `In progress` | the list is empty, the notice "No task matches these filters" appears |
| Filter by status `To do` | the task is listed again |
| Filter by the search term `Deployed` | the task is listed, `zzz-no-match` empties the list |
| Edit the task, status `In progress` | the change is saved and shown |
| Sign out | the cookie of the API origin is deleted, `/teams` redirects to the sign-in screen |
| Sign in again | the team and the task are restored from the session |

The sessions of the live run are in the `session` table of PostgreSQL (25 rows
after the run), so the session store of the deployment is the PostgreSQL one.

The limits of this topology: the address of the API is the address of a quick
tunnel and changes when the tunnel is restarted, and the client and the API are
on different origins, so the session cookie is a third-party cookie. A browser
that blocks third-party cookies has to allow them for the site.

## 5. Before each PR

```powershell
git diff --check
```

Then run the scripts actually defined in the relevant `package.json`, such as tests, lint and build. Do not claim commands passed unless they were run successfully.

## 6. Before submission

- [ ] Clean install works using documented steps.
- [ ] Migrations work on a fresh database.
- [ ] No secrets are tracked by Git.
- [ ] Production build succeeds.
- [ ] All mandatory flows pass.
- [ ] Authorization negative tests pass.
- [ ] Live app works in a fresh browser session.
- [ ] Browser console and server logs have no unresolved critical errors.
