# Glacier Team Task Manager

A full-stack Team Task Manager built for the Glacier Agency Full Stack Development Assessment.

> **Assessment requirements:** React + Tailwind CSS + Vite frontend; Node.js + Express REST API; secure registration/login using Passport.js and Express sessions; PostgreSQL-backed sessions; team and task CRUD; validation; Git/GitHub branching or pull-request history; and a deployed version on Google Cloud Platform (GCP).

## Status

The application is implemented milestone by milestone on feature branches, each
merged through a pull request. The status below reflects what is merged into
`main` today.

- [x] Backend implemented and tested (M1 — foundation and auth)
- [x] PostgreSQL schema and migrations applied
- [x] Authentication and authorization tested
- [x] Team and task workflows tested (M2 — teams; M3 — tasks in pull request #3)
- [x] GitHub feature branches and PR history present
- [ ] GCP deployment verified — the artifacts are in the repository, the project
      has to be created and deployed by the owner
- [ ] Submission links ready — the repository link is verified, the deployed URL
      follows the deployment

The remaining open items are the steps that need access to a Google Cloud
project; they are described in [the deployment runbook](docs/DEPLOYMENT_RUNBOOK.md)
and in [the submission message](docs/SUBMISSION_MESSAGE.md).

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

### 1. Clone and create the database

```powershell
git clone https://github.com/SrRecode/team-task-manager.git
cd team-task-manager
psql -U postgres -c "CREATE DATABASE glacier_tasks;"
```

### 2. API

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

Edit `server/.env`: set `DATABASE_URL` to your local PostgreSQL credentials and
generate a session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Apply the migrations and start the API:

```powershell
npm run migrate
npm run dev
```

The API listens on `http://localhost:5000` and answers `GET /health`.

### 3. Client

In a second terminal:

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

The client runs on `http://localhost:5173` and calls the API at
`VITE_API_URL` (`http://localhost:5000/api` by default).

### 4. Verify

Follow [docs/TESTING.md](docs/TESTING.md) for the end-to-end workflow, or run
the automated suites:

```powershell
cd server
npm test        # node:test against the local test database

cd ..\client
npm run lint
npm run build
```

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
