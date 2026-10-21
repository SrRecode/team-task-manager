# Glacier Team Task Manager

A full-stack Team Task Manager built for the Glacier Agency Full Stack Development Assessment.

> **Assessment requirements:** React + Tailwind CSS + Vite frontend; Node.js + Express REST API; secure registration/login using Passport.js and Express sessions; PostgreSQL-backed sessions; team and task CRUD; validation; Git/GitHub branching or pull-request history; and a deployed version on Google Cloud Platform (GCP).

## Status

This repository is a project blueprint and implementation guide. Update the status and deployment URLs only after you verify the corresponding functionality.

- [x] Frontend implemented and tested
- [x] Backend implemented and tested
- [x] PostgreSQL schema and migrations applied
- [x] Authentication and authorization tested
- [x] Team and task workflows tested
- [x] GitHub feature branches and PR history present
- [ ] GCP deployment verified
- [ ] Submission links ready

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
- [Environment variables](docs/ENVIRONMENT.md)
- [AI coding workflow](docs/AI_WORKFLOW.md)
- [Definition of done](docs/DEFINITION_OF_DONE.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## Suggested repository layout

```text
glacier-task-manager/
├── client/                  # React + Vite + Tailwind
├── server/                  # Express API
├── docs/                    # Project and assessment documentation
├── .github/
│   └── pull_request_template.md
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

Install a supported Node.js LTS version, npm, Git, and PostgreSQL. Verify:

```powershell
node -v
npm -v
git --version
psql --version
```

## Local setup

The commands below were run in this repository with Node.js 24 and PostgreSQL 18.

```powershell
# 1. Install the dependencies of the API and of the client
cd server
npm install
cd ..\client
npm install
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
npm test         # 70 tests: auth, teams and tasks, against a separate test database

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

See [GCP deployment guide](docs/DEPLOYMENT_GCP.md). The assessment requires a deployed version on GCP. Verify current pricing and billing requirements before creating resources; GCP services may incur charges.

## Submission

When complete, submit through Indeed:
- Deployed application URL
- GitHub repository URL

Do not submit placeholder links. Confirm the deployed app works in a fresh browser session first.
