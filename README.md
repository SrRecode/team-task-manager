# Glacier Team Task Manager

A full-stack Team Task Manager built for the Glacier Agency Full Stack Development Assessment.

> **Assessment requirements:** React + Tailwind CSS + Vite frontend; Node.js + Express REST API; secure registration/login using Passport.js and Express sessions; PostgreSQL-backed sessions; team and task CRUD; validation; Git/GitHub branching or pull-request history; and a deployed version on Google Cloud Platform (GCP).

## Status

The application is implemented milestone by milestone on feature branches, each
merged through a pull request. The status below reflects what is merged into
`main` today.

- [x] Frontend implemented and tested (React, Tailwind CSS, Vite)
- [x] Backend implemented and tested (Node.js, Express, Passport.js, sessions)
- [x] PostgreSQL schema and migrations applied
- [x] Authentication and authorization tested
- [x] Team and task workflows tested
- [x] Bonus features: due-date reminders (BONUS-01), owner/member roles
      (BONUS-02), email invitation stub (BONUS-03)
- [x] GitHub feature branches and PR history present
- [x] Frontend deployed on GCP (Firebase Hosting) — <https://glacier-team-task-manager.web.app>
- [ ] API and database deployed on GCP — blocked by the permissions of the
      assessment account, see [the deployment runbook](docs/DEPLOYMENT_RUNBOOK.md)
- [ ] Submission links ready — the repository link is verified, the deployed URL
      follows the deployment

The deployment of the API and of the Cloud SQL database is the only open item.
The account of the assessment may not create a Cloud Run service and may not
create a Cloud SQL instance in the free tier project, and the project it owns
has no billing account. The findings and the single action that unblocks the
deployment are in [the deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) § 0.0.
The deployment itself is one command:

```powershell
.\deploy\deploy.ps1 -ProjectId glacier-team-task-manager -Region asia-south1
```

## Documentation map

- [Project plan](docs/PROJECT_PLAN.md)
- [Requirements traceability](docs/ASSESSMENT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API contract](docs/API.md)
- [Authentication and security](docs/SECURITY.md)
- [Frontend guide](docs/FRONTEND.md)
- [Backend guide](docs/BACKEND.md)
- [Git and GitHub workflow](docs/GIT_WORKFLOW.md)
- [Testing and QA](docs/TESTING.md)
- [Deployment on GCP](docs/DEPLOYMENT_GCP.md)
- [Deployment runbook (step by step)](docs/DEPLOYMENT_RUNBOOK.md)
- [Deployment script (one command)](deploy/deploy.ps1)
- [Environment variables](docs/ENVIRONMENT.md)
- [AI coding workflow](docs/AI_WORKFLOW.md)
- [Definition of done](docs/DEFINITION_OF_DONE.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## Repository layout

```text
team-task-manager/
├── client/                  # React + Vite + Tailwind frontend
│   └── firebase.json        # Firebase Hosting configuration
├── server/                  # Express + Passport API
│   ├── Dockerfile           # Production image for Cloud Run
│   └── .dockerignore
├── deploy/
│   └── cloud-run-api.yaml   # Cloud Run service + Cloud SQL Proxy sidecar
├── docs/                    # Project, assessment and deployment documentation
├── .github/
│   ├── workflows/ci.yml     # Server tests, client lint and build
│   └── pull_request_template.md
├── .gitignore
└── README.md
```

There is no root `package.json`: the client and the server are installed and
run separately.

## Prerequisites

Install a supported Node.js LTS version (Node 22 is used in CI), npm, Git, and
PostgreSQL 14 or newer. Verify:

```powershell
node -v
npm -v
git --version
psql --version
```

## Local setup

The commands below were run in this repository with Node.js 24 and PostgreSQL 18.

```powershell
# 1. Clone the repository and install the dependencies of the API and of the client
git clone https://github.com/SrRecode/team-task-manager.git
cd team-task-manager
cd server
npm ci
cd ..\client
npm ci
cd ..

# 2. Configure the environment
copy server\.env.example server\.env    # then fill in DATABASE_URL and SESSION_SECRET
copy client\.env.example client\.env    # optional, the API URL already defaults to http://localhost:5000/api

# 3. Create the database and apply the migrations
createdb glacier_tasks
cd server
npm run migrate

# 4. Start the API and the client in two terminals
npm start        # http://localhost:5000, health check at /health
cd ..\client
npm run dev      # http://localhost:5173
```

The API refuses to start without `DATABASE_URL` and `SESSION_SECRET`. Generate a
session secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### Tests, lint and build

```powershell
cd server
npm test         # 90 tests: auth, teams, tasks, invitations and reminders, against a separate test database

cd ..\client
npm run lint
npm run build
```

The test suite needs its own PostgreSQL database. It derives the name
`glacier_tasks_test` from `DATABASE_URL` and creates the tables itself, so
create that database once:

```powershell
createdb glacier_tasks_test
```

The tables are truncated before every test, so the test database must not be
used for anything else. Set `TEST_DATABASE_NAME` to use a different name.

### The application in the browser

1. Register a user and sign in.
2. Create a team and add a second registered user to it.
3. Create a task in the team, assign it to a member and change its status.
4. Filter the tasks by team, assignee, status and search term.
5. Sign out and confirm that the protected API routes answer with 401.

## Bonus features

Two of the optional requirements are implemented on top of the milestones.

### BONUS-01: due-date reminders

`GET /api/reminders` returns the tasks of the signed in user that are assigned
to them, are not finished and have a due date, grouped into `overdue`, `today`
and `upcoming` (the next 7 days). The dashboard shows the groups in a
**Reminders** panel, so the reminder is visible right after the sign in. The
groups are calculated by the database (`CURRENT_DATE`), so the server and the
database always agree on what "today" is. No email is sent: the assessment
does not require a mail server.

### BONUS-03: invitation stub

`POST /api/teams/:teamId/invites` records an invitation for an email address
that does not have to be registered yet. The response says so explicitly
(`delivery: "stub"`, `notificationSent: false`), because the invitation is a
row in the database instead of a sent email. The pending invitations are
listed in the team panel, and the owner can revoke one.

The invitation is not a dead record: when the invited address registers an
account or signs in, the invitation is turned into a real membership in the
same transaction, and the app shows a notice that the new team was joined
because of the invitation.

## Core user flows

1. Register a user and log in.
2. Create a team.
3. Add an existing registered user to the team.
4. Create a task within the team.
5. Assign the task to a member of that same team.
6. Edit task details/status and delete a task where authorized.
7. Filter tasks by team and assignee.
8. Log out and verify protected API requests are rejected.

## Security baseline

- Store only password hashes, never plaintext passwords.
- Use parameterized SQL queries.
- Validate body, route parameters, and query parameters on the server.
- Require authentication for every non-authentication API route.
- Check team membership and role/permission on every protected operation.
- Use PostgreSQL-backed session storage in deployed environments.
- Set secure production cookies and configure CORS deliberately.
- Protect cookie-authenticated state-changing requests against CSRF.
- Never commit `.env`, service-account keys, database passwords, or session secrets.

## Deployment

See [the deployment guide](docs/DEPLOYMENT_GCP.md) for the architecture and
[the deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) for the exact commands:
Artifact Registry, Cloud SQL, Secret Manager, the Cloud Run service with the
Cloud SQL Auth Proxy sidecar, and Firebase Hosting for the client. The API is
packaged by `server/Dockerfile`.

`deploy/deploy.ps1` performs the whole deployment in one command:

```powershell
.\deploy\deploy.ps1 -Check                                   # check the environment
.\deploy\deploy.ps1 -ProjectId PROJECT_ID -Region REGION     # deploy everything
```

The project needs a billing account, and the account needs the permission to
create the billable resources.

The frontend of this project is already deployed on Firebase Hosting:
<https://glacier-team-task-manager.web.app>. It calls the API on its own
origin (`/api`), and Firebase Hosting forwards the calls to the Cloud Run
service, so the session cookie stays a first-party cookie. The API and the
Cloud SQL database are the part that is still missing; the exact blocker and
the single action that solves it are in
[the deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) § 0.0.

The assessment requires a deployed version on GCP. Verify current pricing and
billing requirements before creating resources; GCP services may incur charges.

## Submission

When complete, submit through Indeed:
- Deployed application URL — `REPLACE_WITH_VERIFIED_DEPLOYED_URL`
- API URL — `REPLACE_WITH_VERIFIED_API_URL`
- GitHub repository URL — https://github.com/SrRecode/team-task-manager

The ready-to-send message and the pre-send checklist are in
[docs/SUBMISSION_MESSAGE.md](docs/SUBMISSION_MESSAGE.md). Do not submit
placeholder links. Confirm the deployed app works in a fresh browser session
first.
