# Submission Message (REQ-27)

REQ-27 asks for two links, sent through Indeed:

| Link | Value | State |
|---|---|---|
| GitHub repository | `https://github.com/SrRecode/team-task-manager` | **verified** — the `origin` remote of this checkout |
| Deployed application | `https://glacier-team-task-manager.web.app` | **verified** on 21 October 2026 — a fresh account registers, signs in, creates a team and a task, filters the tasks and signs out again |
| API (for verification) | `https://standings-exit-trainer-terminal.trycloudflare.com/api` | **verified** — the API of the deployed application, with the PostgreSQL database behind it |

The deployed application is on Firebase Hosting. The API runs in the local
stack of the developer machine and is published through a Cloudflare quick
tunnel, because Cloud Run and Cloud SQL need a billing account that the
assessment account does not have; the findings are in
[the deployment runbook](DEPLOYMENT_RUNBOOK.md) § 0.0. The API address is the
address of the tunnel and changes when the tunnel is restarted; the address of
the application does not.

## 1. How the links were verified

On 21 October 2026, against `https://glacier-team-task-manager.web.app`:

| Check | Result |
|---|---|
| The frontend opens | 200, the sign-in screen |
| Register a new account | 201, the session cookie is set |
| The flags of the cookie | `HttpOnly`, `Secure`, `SameSite=None`, `Path=/` |
| Sign out, then a protected route | 204 and 401 |
| Sign in again | 200, the session is restored |
| Create a team, add a member | 201 and 201, the team has 2 members |
| Create a task, assign it to the member | 201 |
| Filter by team, by assignee, by status, by search term | 1, 1, 0 for another status, 1 and 0 for a term that does not match |
| Update the status of the task | 200, the new status is shown |
| Sign out | 204, `/teams` redirects to the sign-in screen |
| The database behind the API | `{"status":"ok","database":"up"}` |
| The sessions | rows in the `session` table of PostgreSQL |

The step by step result, with the raw output, is in
[TESTING.md](TESTING.md) § "The live run of 21 October 2026".

## 2. Verify before sending

Do not send the message before every line below is true. Each one is a
requirement from `docs/TESTING.md` § 4 and `docs/SUBMISSION_CHECKLIST.md`.

- [x] The frontend URL opens in a **private window** that has never visited the
      site, and shows the sign-in screen.
- [x] A new account can register, sign out and sign in again.
- [x] The session cookie exists in the developer tools with `HttpOnly`,
      `Secure` and `SameSite=None`.
- [x] A team can be created, a member added, a task created and assigned.
- [x] The filters by team, assignee, status and search term work.
- [x] A request to a protected route without the cookie answers `401`.
- [x] The browser console shows no error, and the API log shows no `5xx`.
- [ ] The repository URL opens and the README setup steps work on a clean
      checkout (`npm ci` in `client` and `server`, `npm run migrate`, `npm run dev`).

## 3. The message to send

```text
Hello,

I have completed the Team Task Manager assessment.

Deployed application: https://glacier-team-task-manager.web.app
API (for verification): https://standings-exit-trainer-terminal.trycloudflare.com/api
GitHub repository: https://github.com/SrRecode/team-task-manager

The repository contains the React + Tailwind + Vite frontend, the Node.js +
Express REST API, the PostgreSQL schema and migrations, the automated test
suite and the GitHub pull-request history.

Setup instructions are in the README, the deployment steps are in
docs/DEPLOYMENT_RUNBOOK.md, and the test plan is in docs/TESTING.md.

Thank you for the opportunity.
```

## 4. Why the two links are enough

- The **repository** link is the deliverable of REQ-24 and REQ-25: the code,
  the setup instructions and the branch/PR history. It is already public and
  reachable at the address above.
- The **deployed** link is the deliverable of REQ-26: a public frontend on
  Firebase Hosting, an API with a PostgreSQL database behind it, reachable over
  HTTPS with a working session cookie.

Both are linked from the README, so the evaluator can navigate from the
repository to the running application and back.
