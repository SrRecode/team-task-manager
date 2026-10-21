# Glacier Team Task Manager

A full-stack **Team Task Manager** built for the Glacier Agency Full Stack Development Assessment.
Users register, sign in, create teams, add members, and manage the tasks of those teams with
filters, search, due dates and in-app reminders. The client is a React single-page application,
the API is an Express REST service with cookie sessions, and the data lives in PostgreSQL.

> **Stack in one line:** React 19 + Vite 8 + Tailwind CSS 4 (client) · Node.js + Express 5 +
> Passport.js + `express-session` (API) · PostgreSQL with a PostgreSQL-backed session store ·
> Docker + Google Cloud (Cloud Run, Cloud SQL) and Firebase Hosting (deployment).

---

## Table of contents

1. [Assessment context](#1-assessment-context)
2. [Implementation status](#2-implementation-status)
3. [Features](#3-features)
4. [Technology stack](#4-technology-stack)
5. [Architecture](#5-architecture)
6. [Repository layout](#6-repository-layout)
7. [Prerequisites](#7-prerequisites)
8. [Installation](#8-installation)
9. [Environment variables](#9-environment-variables)
10. [PostgreSQL setup](#10-postgresql-setup)
11. [Database migrations](#11-database-migrations)
12. [Running the application locally](#12-running-the-application-locally)
13. [Authentication and sessions](#13-authentication-and-sessions)
14. [API reference](#14-api-reference)
15. [Core workflows](#15-core-workflows)
16. [Database schema](#16-database-schema)
17. [Bonus features](#17-bonus-features)
18. [Testing, linting and production build](#18-testing-linting-and-production-build)
19. [Security](#19-security)
20. [Git and GitHub workflow](#20-git-and-github-workflow)
21. [Continuous integration](#21-continuous-integration)
22. [Deployment](#22-deployment)
23. [Current deployment status](#23-current-deployment-status)
24. [Troubleshooting](#24-troubleshooting)
25. [Documentation index](#25-documentation-index)
26. [Assessment submission checklist](#26-assessment-submission-checklist)
27. [Limitations and next steps](#27-limitations-and-next-steps)

---

## 1. Assessment context

The brief is a "Team Task Manager" web application for an agency: registration and login,
teams with members, tasks inside those teams, a dashboard, filtering, clean setup instructions,
real Git history, and a deployed version on Google Cloud Platform.

The full requirement list, with the evidence for every item, is in
[docs/ASSESSMENT_REQUIREMENTS.md](docs/ASSESSMENT_REQUIREMENTS.md) (REQ-01 … REQ-27 and
BONUS-01 … BONUS-03). The two optional bonuses that the assessment names — due-date reminders
and role-based access — are implemented, as is the third one (email invitations, stubbed).

---

## 2. Implementation status

Everything below was checked against the source code on **21 October 2026**. The code is the
content of `main`; the last milestone was merged from the branch `fix/assessment-compliance`.

| Area | Status | Evidence |
|---|---|---|
| Frontend (React, Vite, Tailwind CSS) | Implemented | `client/src/`, `npm run build` succeeds |
| API (Express 5, Passport.js, sessions) | Implemented | `server/src/`, `npm start` serves `/health` |
| PostgreSQL schema and migrations | Implemented | `server/src/db/migrations/`, applied to `glacier_tasks` |
| Registration, login, logout, current user | Implemented | `server/src/modules/auth/`, 24 auth tests |
| Teams: create, list, rename, delete, members | Implemented | `server/src/modules/teams/`, 25 team tests |
| Tasks: create, assign, update, delete, filter, search | Implemented | `server/src/modules/tasks/`, 21 task tests |
| Due-date reminders (BONUS-01) | Implemented | `server/src/modules/reminders/`, 9 reminder tests |
| Owner / member roles (BONUS-02) | Implemented | `team_members.role` + `requireTeamOwner` |
| Email invitations (BONUS-03, stub) | Implemented, no mail server | `server/src/modules/teams/invite.service.js` |
| API test suite | **90 tests, 90 passing** | `cd server; npm test` (48 s) |
| Client lint | **Passing, no findings** | `cd client; npm run lint` (exit 0) |
| Client production build | **Passing** | `cd client; npm run build` (50 modules, 2 s) |
| Frontend deployed on GCP | **Deployed and verified** | <https://glacier-team-task-manager.web.app> |
| API reachable from the deployed app | **Live through a Cloudflare quick tunnel** | <https://standings-exit-trainer-terminal.trycloudflare.com/api> |
| End-to-end check against the deployed app | **Verified** | `server/scripts/smoke-live.js`, full run green |
| API and database on **Cloud Run + Cloud SQL** | **Not deployed — blocked** | No billing account, `run.services.create` denied (see [§22](#22-deployment)) |

Two things are deliberately *not* implemented, and this README does not pretend otherwise:
there is **no mail server** (invitations are database records), and there is **no rate limiting**
on the authentication endpoints. Both are listed in [§19](#19-security).

---

## 3. Features

### Implemented

**Accounts and sessions**
- Register with name, email and password; sign in and sign out; `GET /api/auth/me` restores the
  session on page reload.
- Passwords are stored as bcrypt hashes (cost 12). The password hash is never sent to the client
  and never written into the session store — only the user id is.
- The sign-in failure message is identical for "unknown email" and "wrong password", and the
  server compares against a dummy hash in the unknown-email case, so the endpoint cannot be used
  to enumerate registered addresses.

**Teams**
- Create a team (the creator becomes its owner in the same transaction), rename it, describe it
  and delete it.
- Add an existing registered user by email, remove a member, and let a member leave a team.
- Two roles: `owner` and `member`. Only the owner may add members, edit the team, invite people,
  revoke invitations or delete the team.
- The owner cannot remove themselves; a team without an owner could never be managed again.

**Tasks**
- Create a task with title, description, status, due date and an optional assignee.
- The assignee must be a member of the same team. This is checked in the service *and* enforced
  by a composite foreign key in the database, so the rule holds even for direct SQL writes.
- A task belongs to exactly one team for its whole life: `teamId` cannot be changed.
- Edit and delete are limited to the member who created the task and to the owner of its team.
  Other members can read the task. The UI hides the buttons; the server enforces the rule.
- Delete asks for a confirmation in the UI.

**Dashboard**
- Task list with team name, assignee, due date and a status badge.
- Filters for team, assignee and status, plus a free-text search over title and description. The
  search is debounced by 300 ms and the filters are always combined with the caller's own team
  access, so a filter can never widen what the caller may see.
- A **Reminders** panel with the due dates of the signed-in user, split into *overdue*, *today*
  and *upcoming* (the next 7 days).
- A team summary with the member count per team, and an empty state that points to the team
  page when the user has no team yet.

**Interface**
- Client-side validation on every form, with the server's field errors mapped back onto the
  matching input.
- Confirmation messages (toasts) after every successful action, inline error messages, and
  loading states for every list.
- Responsive layout: a hamburger menu on small screens, a normal navigation bar from `md` up.
- Accessible markup: labelled fields, `role="alert"` for errors, `role="status"` for
  confirmations, `aria-invalid` / `aria-describedby` on invalid fields, and a visible focus ring.

### Not implemented (and not required by the assessment)

- Sending email (invitations are database records only).
- Rate limiting, account lockout, password reset, multi-factor authentication.
- Token-based CSRF (the API uses an origin check instead, see [§19](#19-security)).
- Real-time updates, a Kanban board, file attachments, pagination.
- A seeded demo data script: the database starts empty, and the demo rows that were used during
  the verification run were created manually.

---

## 4. Technology stack

| Layer | Technology | Version | Where |
|---|---|---|---|
| **Frontend** | React / React DOM | 19.3.1 | `client/package.json` |
| | React Router | 7.18.4 | `client/src/App.jsx` |
| | Vite | 8.3.4 | `client/vite.config.js` |
| | Tailwind CSS (+ `@tailwindcss/vite`) | 4.3.3 | `client/src/index.css` |
| | ESLint (`eslint-plugin-react-hooks`, `-react-refresh`) | 10.13.1 | `client/eslint.config.js` |
| **Backend** | Node.js | `>=20` (`engines`), 22 in CI | `server/package.json` |
| | Express | 5.3.0 | `server/src/app.js` |
| | Passport.js + `passport-local` | 0.7.0 / 1.0.0 | `server/src/config/passport.js` |
| | `express-session` + `connect-pg-simple` | 1.18.2 / 10.0.0 | `server/src/config/session.js` |
| | `express-validator` | 7.3.2 | `server/src/middleware/validate.js` |
| | `pg` | 8.16.3 | `server/src/config/database.js` |
| | `bcrypt` | 6.0.0 | `server/src/modules/auth/auth.service.js` |
| | `helmet`, `cors`, `morgan`, `dotenv` | 8.1.0 / 2.8.5 / 1.10.1 / 18.0.8 | `server/src/app.js` |
| **Database** | PostgreSQL | 16 (CI and Cloud Run template), verified on 18 | `server/src/db/migrations/` |
| **Testing** | `node:test` + `supertest` | Node 22 built-in / 7.1.4 | `server/test/` |
| **Deployment** | Docker (`node:22-alpine`), Cloud Run, Cloud SQL + Auth Proxy sidecar, Secret Manager, Artifact Registry | — | `server/Dockerfile`, `deploy/` |
| | Firebase Hosting | — | `client/firebase.json` |

There is **no root `package.json`** in the repository: the client and the server have their own
manifests and are installed, run and tested separately.

---

## 5. Architecture

### How a request flows

1. The browser loads the single-page application from static hosting (Vite dev server locally,
   Firebase Hosting in the deployed version).
2. The client calls the REST API. The base URL comes from `VITE_API_URL`; in a dev build it
   falls back to `http://localhost:5000/api`, in a production build it falls back to `/api` on
   the same origin.
3. The API authenticates the request with the `glacier.sid` session cookie
   (Passport.js `LocalStrategy` → `requireAuth` → resource-level authorization middleware).
4. The service layer runs parameterised SQL against PostgreSQL. Sessions live in the `session`
   table through `connect-pg-simple`, so a session survives an API restart.
5. The client re-renders the page from the JSON response and shows a confirmation or an error.

### Diagram

```mermaid
flowchart LR
    Browser["Browser<br/>React 19 SPA"] -->|HTTPS| Hosting["Static hosting<br/>Firebase Hosting / Vite"]
    Browser -->|"fetch with credentials<br/>session cookie"| API["Express 5 API<br/>/api + /health"]
    API --> Auth["Passport.js local strategy<br/>+ requireAuth middleware"]
    Auth --> Services["Service layer<br/>auth · teams · tasks · reminders"]
    Services -->|parameterised SQL| DB[("PostgreSQL<br/>users · teams · team_members<br/>tasks · team_invites · session")]
    API --> Errors["Central error handler<br/>safe messages, no stack traces"]
```

### Deployment topology as it works today

```text
Browser
  └─► https://glacier-team-task-manager.web.app      (Firebase Hosting, static bundle)
        └─► https://standings-exit-trainer-terminal.trycloudflare.com/api   (Cloudflare quick tunnel)
              └─► http://127.0.0.1:5000               (Express API, NODE_ENV=production)
                    └─► postgresql://…/glacier_tasks   (local PostgreSQL 18)
```

The intended production topology replaces the tunnel and the local database with Cloud Run and
Cloud SQL; see [§22](#22-deployment).

---

## 6. Repository layout

Generated from the tracked files of the repository (`git ls-files`).

```text
team-task-manager/
├── .github/
│   ├── pull_request_template.md          # template for every pull request
│   └── workflows/ci.yml                  # GitHub Actions: API tests, client lint and build
├── client/                               # React + Vite + Tailwind frontend
│   ├── .env.example                      # VITE_API_URL placeholder
│   ├── .gitignore
│   ├── README.md                         # the Vite template text (not project documentation)
│   ├── eslint.config.js                  # ESLint flat config
│   ├── firebase.json                     # Firebase Hosting config (SPA rewrite only)
│   ├── index.html                        # Vite entry document
│   ├── package.json                      # scripts and dependencies
│   ├── package-lock.json                 # pinned dependency tree
│   ├── public/favicon.svg
│   ├── vite.config.js                    # Vite plugins: React and Tailwind CSS
│   └── src/
│       ├── main.jsx                      # React root, BrowserRouter, providers
│       ├── App.jsx                       # routes: /, /teams, /login, /register
│       ├── index.css                     # Tailwind import + design tokens
│       ├── api/
│       │   ├── http.js                   # fetch wrapper: base URL, timeout, JSON errors
│       │   ├── auth.api.js               # register, login, logout, me
│       │   ├── teams.api.js              # teams, members, invitations
│       │   ├── tasks.api.js              # task CRUD and filter parameters
│       │   └── reminders.api.js          # due-date reminders
│       ├── components/
│       │   ├── layout/AppShell.jsx       # header, navigation, mobile menu, invite notice
│       │   ├── reminders/ReminderPanel.jsx
│       │   ├── tasks/
│       │   │   ├── TaskFilters.jsx       # team, assignee, status, search
│       │   │   ├── TaskList.jsx          # task rows, inline delete confirmation
│       │   │   ├── TaskModal.jsx         # create and edit dialog
│       │   │   └── taskStatus.js         # status labels
│       │   └── teams/
│       │       ├── TeamPanel.jsx         # members, invitations, owner settings
│       │       └── TeamSummary.jsx       # teams with member counts
│       ├── context/
│       │   ├── AuthProvider.jsx          # session state, invites accepted on sign-in
│       │   ├── ToastProvider.jsx         # confirmation messages
│       │   ├── auth-context.js           # the auth context object
│       │   ├── toast-context.js          # the toast context object
│       │   ├── useAuth.js                # hook for the auth context
│       │   └── useToast.js               # hook for the toast context
│       ├── lib/validation.js             # client-side form rules
│       ├── pages/
│       │   ├── AuthPages.jsx             # sign in and sign up
│       │   ├── DashboardPage.jsx         # task list, filters, reminders, team summary
│       │   └── TeamsPage.jsx             # team list, create form, team detail
│       └── routes/ProtectedRoute.jsx     # redirects anonymous visitors to /login
├── deploy/
│   ├── cloud-run-api.yaml                # Cloud Run service + Cloud SQL Proxy sidecar
│   └── deploy.ps1                        # one-command deployment for the whole stack
├── docs/                                 # project, assessment and deployment documentation
│   ├── AI_WORKFLOW.md                    # how the AI-assisted workflow is run
│   ├── API.md                             # REST contract in detail
│   ├── ARCHITECTURE.md                   # system architecture
│   ├── ASSESSMENT_REQUIREMENTS.md        # requirement traceability (REQ-01 … REQ-27)
│   ├── AUDIT_REPORT.md                   # the initial repository audit
│   ├── BACKEND.md                        # backend implementation guide
│   ├── DATABASE.md                       # database design
│   ├── DEFINITION_OF_DONE.md             # what "done" means for this project
│   ├── DEPLOYMENT_GCP.md                 # the intended GCP architecture
│   ├── DEPLOYMENT_RUNBOOK.md             # step-by-step deployment runbook
│   ├── ENVIRONMENT.md                    # environment variable rules
│   ├── FRONTEND.md                       # frontend implementation guide
│   ├── GIT_WORKFLOW.md                   # branch and pull-request conventions
│   ├── PROJECT_PLAN.md                   # milestone plan
│   ├── SECURITY.md                       # security baseline
│   ├── SUBMISSION_CHECKLIST.md           # pre-send checklist
│   ├── SUBMISSION_MESSAGE.md             # ready-to-send message for the submission
│   ├── TESTING.md                        # test plan and the recorded results
│   └── design/ui-mockup.html             # static UI mockup of the design
├── server/                               # Express + Passport API
│   ├── .dockerignore                     # keep secrets and dependencies out of the image
│   ├── .env.example                      # every server variable with placeholders
│   ├── .gcloudignore                     # keep secrets out of the Cloud Build context
│   ├── Dockerfile                        # production image (node:22-alpine, non-root)
│   ├── package.json                      # scripts and dependencies
│   ├── package-lock.json                 # pinned dependency tree
│   ├── scripts/smoke-live.js             # end-to-end script against a deployed application
│   ├── src/
│   │   ├── server.js                     # entry point: env, session, app, listen, shutdown
│   │   ├── app.js                        # Express app: helmet, cors, json limit, routes
│   │   ├── config/
│   │   │   ├── database.js               # pg pool, query helper, withTransaction
│   │   │   ├── env.js                    # environment reading and validation
│   │   │   ├── passport.js               # local strategy, serialise/deserialise user
│   │   │   ├── passwords.js              # bcrypt cost factor
│   │   │   └── session.js                # session store and cookie options
│   │   ├── db/
│   │   │   ├── migrate.js                # migration runner with a tracking table
│   │   │   └── migrations/
│   │   │       ├── 001_init.sql          # users, teams, team_members, tasks, session
│   │   │       └── 002_team_invites.sql  # pending invitations
│   │   ├── middleware/
│   │   │   ├── csrfOrigin.js             # origin check for cookie-authenticated writes
│   │   │   ├── errorHandler.js           # central error handler and 404 handler
│   │   │   ├── requireAuth.js            # session check
│   │   │   ├── requireTaskAccess.js      # task visible to the caller
│   │   │   ├── requireTaskEditor.js      # creator or team owner may change a task
│   │   │   ├── requireTeamMember.js      # team membership check
│   │   │   ├── requireTeamOwner.js       # owner-only actions
│   │   │   └── validate.js               # express-validator request schemas
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.js       # /api/auth routes
│   │   │   │   ├── auth.controller.js   # request handling and status codes
│   │   │   │   └── auth.service.js      # user lookup, bcrypt hashing, email normalisation
│   │   │   ├── reminders/
│   │   │   │   ├── reminder.routes.js   # /api/reminders routes
│   │   │   │   ├── reminder.controller.js
│   │   │   │   └── reminder.service.js  # overdue / today / upcoming grouping
│   │   │   ├── tasks/
│   │   │   │   ├── task.routes.js       # /api/tasks routes
│   │   │   │   ├── task.controller.js
│   │   │   │   └── task.service.js      # task CRUD, filters, search, edit policy
│   │   │   └── teams/
│   │   │       ├── team.routes.js       # /api/teams routes
│   │   │       ├── team.controller.js
│   │   │       ├── team.service.js      # teams and memberships
│   │   │       └── invite.service.js    # invitations and their acceptance
│   │   └── utils/
│   │       ├── email.js                  # email normalisation
│   │       └── errors.js                 # AppError and the error helpers
│   ├── test/                             # node:test + supertest
│   │   ├── auth.test.js                  # 24 tests
│   │   ├── teams.test.js                 # 25 tests
│   │   ├── tasks.test.js                 # 21 tests
│   │   ├── invites.test.js               # 11 tests
│   │   └── reminders.test.js             # 9 tests
│   └── test-support/database.js          # test database bootstrap and truncation
├── .gitignore
└── README.md
```

The tree was generated from the tracked files of the repository (`git ls-files`) and contains
every tracked file.

---

## 7. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | `>=20` (`server/package.json` `engines`) | CI uses Node 22; this repository was verified with Node 24.19.0 and npm 11.5.2 |
| npm | ships with Node | `npm ci` is used everywhere |
| PostgreSQL | 16 or newer | CI uses the `postgres:16` image, the Cloud Run template targets PostgreSQL 16, this machine runs PostgreSQL 18 |
| Git | 2.40+ | only needed to clone the repository |
| Firebase CLI | latest | **only** for the deployment of the frontend; not a project dependency |

Check the toolchain:

```powershell
node -v
npm -v
git --version
```

The Firebase CLI is installed once, globally, and is not part of this repository:

```powershell
npm install -g firebase-tools
firebase --version
```

Without a global installation the same commands work through `npx`, for example
`npx firebase-tools deploy --only hosting --project PROJECT_ID`.

---

## 8. Installation

All commands are PowerShell. The client and the server are installed separately; there is no
root `package.json`.

```powershell
# 1. Clone
git clone https://github.com/SrRecode/team-task-manager.git
cd team-task-manager

# 2. Install the API dependencies (working directory: repository root)
cd server
npm ci
cd ..

# 3. Install the client dependencies (working directory: repository root)
cd client
npm ci
cd ..

# 4. Create the environment files (working directory: repository root)
copy server\.env.example server\.env     # then fill in DATABASE_URL and SESSION_SECRET
copy client\.env.example client\.env     # optional, the API URL defaults to http://localhost:5000/api
```

`server/.env` and `client/.env` are gitignored. Never commit real secrets.

Generate a session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 9. Environment variables

### 9.1 Server (`server/.env`)

Read by `server/src/config/env.js`; unknown keys are rejected and a missing required key stops
the process with an actionable message.

| Variable | Purpose | Required | Example | Used by |
|---|---|---|---|---|
| `NODE_ENV` | `development` or `production`; decides the session store and the `Secure` cookie flag | yes | `development` | `config/env.js`, `config/session.js` |
| `PORT` | Port the API listens on | yes | `5000` | `src/server.js` |
| `DATABASE_URL` | PostgreSQL connection string | yes | `postgresql://glacier:glacier@localhost:5432/glacier_tasks` | `config/database.js` |
| `DATABASE_SSL` | `true` for a managed database that requires TLS | no (default `false`) | `false` | `config/database.js` |
| `SESSION_SECRET` | Signs the session cookie; at least 32 characters | yes | `3f9a…(64 hex characters)` | `config/session.js` |
| `SESSION_NAME` | Name of the session cookie | no (default `glacier.sid`) | `glacier.sid` | `config/session.js` |
| `SESSION_MAX_AGE_MS` | Session lifetime in milliseconds | no (default `86400000`, 24 h) | `86400000` | `config/session.js` |
| `SESSION_SAME_SITE` | `lax` for a same-site deployment, `none` for a cross-site deployment over HTTPS | no (default `lax`) | `none` | `config/session.js` |
| `CLIENT_ORIGIN` | Exact origin of the frontend; used for CORS and the origin check | yes | `http://localhost:5173` | `app.js`, `middleware/csrfOrigin.js` |
| `EXTRA_ALLOWED_ORIGINS` | Comma-separated additional allowed origins | no | `https://another-domain.example` | `app.js`, `middleware/csrfOrigin.js` |
| `TEST_DATABASE_NAME` | Name of the database the test suite uses | no (default `glacier_tasks_test`) | `glacier_tasks_test` | `test-support/database.js` |

### 9.2 Client (`client/.env`)

| Variable | Purpose | Required | Example | Used by |
|---|---|---|---|---|
| `VITE_API_URL` | Base URL of the REST API, including `/api` | no | `http://localhost:5000/api` | `client/src/api/http.js` |

`VITE_` variables are compiled into the browser bundle, so only non-secret configuration belongs
there. When `VITE_API_URL` is not set, the client uses `http://localhost:5000/api` in a dev build
and `/api` (same origin) in a production build.

---

## 10. PostgreSQL setup

Create a role and a database. The examples below use the `glacier` role and the `glacier_tasks`
database, which is also what the CI workflow uses.

```powershell
# Windows: the PostgreSQL binaries are not on PATH by default.
# Adjust the version folder to the one you installed (16, 17, 18, …).
$pg = "C:\Program Files\PostgreSQL\18\bin"

& "$pg\psql.exe" -U postgres -c "CREATE ROLE glacier WITH LOGIN PASSWORD 'glacier' CREATEDB;"
& "$pg\createdb.exe" -U glacier -O glacier glacier_tasks
& "$pg\createdb.exe" -U glacier -O glacier glacier_tasks_test   # for the test suite
```

If the `psql` and `createdb` commands are on your PATH, you can use them directly:

```powershell
createdb -U glacier -O glacier glacier_tasks
createdb -U glacier -O glacier glacier_tasks_test
```

The application refuses to start without `DATABASE_URL` and `SESSION_SECRET`, and the test suite
refuses to run without `DATABASE_URL`:

```dotenv
DATABASE_URL=postgresql://glacier:glacier@localhost:5432/glacier_tasks
```

---

## 11. Database migrations

Migrations are plain SQL files in `server/src/db/migrations/`, applied in file-name order by a
small runner. The runner keeps a `schema_migrations` table and applies every file that is not
recorded yet; each file runs in its own transaction, so a failure leaves the database on the last
successful migration. Migrations are a deliberate release step — no HTTP request ever triggers
them.

```powershell
# working directory: server
npm run migrate
```

Expected output on an up-to-date database:

```text
[migrate] skip 001_init.sql (already applied)
[migrate] skip 002_team_invites.sql (already applied)
[migrate] schema is already up to date
```

| Migration | Content |
|---|---|
| `001_init.sql` | `users`, `teams`, `team_members`, `tasks`, the `session` table, the indexes, the task-assignee constraint and the `updated_at` triggers |
| `002_team_invites.sql` | `team_invites` with a partial unique index for pending invitations |

---

## 12. Running the application locally

Two terminals, two working directories.

**Terminal 1 — the API** (working directory `server`):

```powershell
cd server
npm start          # http://localhost:5000
```

**Terminal 2 — the client** (working directory `client`):

```powershell
cd client
npm run dev        # http://localhost:5173
```

Open <http://localhost:5173>. The client talks to `http://localhost:5000/api` by default.

| Command | Working directory | What it does |
|---|---|---|
| `npm start` | `server` | starts the API (`node src/server.js`) |
| `npm run dev` | `server` | starts the API with the file watcher of Node (`node --watch`) |
| `npm run migrate` | `server` | applies the pending migrations |
| `npm test` | `server` | runs the API test suite against `glacier_tasks_test` |
| `npm run dev` | `client` | starts the Vite dev server on port 5173 |
| `npm run build` | `client` | production build into `client/dist` |
| `npm run preview` | `client` | serves the production build locally |
| `npm run lint` | `client` | ESLint over the client sources |

Health check of a running API:

```powershell
Invoke-WebRequest -Uri http://localhost:5000/health -UseBasicParsing | Select-Object -ExpandProperty Content
# {"status":"ok"}

Invoke-WebRequest -Uri "http://localhost:5000/health?database=true" -UseBasicParsing | Select-Object -ExpandProperty Content
# {"status":"ok","database":"up"}
```

---

## 13. Authentication and sessions

- **Registration** (`POST /api/auth/register`) creates the user with a bcrypt hash (cost 12) and
  signs the session in immediately. A duplicate email is answered with `409`.
- **Sign in** (`POST /api/auth/login`) uses the Passport.js local strategy. The failure message is
  the same for an unknown address and for a wrong password.
- **The session** is a `glacier.sid` cookie with `httpOnly: true`, a finite lifetime
  (`SESSION_MAX_AGE_MS`, 24 hours by default) and `secure: true` when `NODE_ENV=production`.
  The cookie is `SameSite=None` when `SESSION_SAME_SITE=none`, which is what a cross-site
  deployment (frontend on Firebase Hosting, API on a different origin) needs.
- **The session store** is PostgreSQL (`connect-pg-simple`) whenever `DATABASE_URL` is set — that
  is every environment that has a database, including production. The in-memory store is a
  development-only fallback for the case where no `DATABASE_URL` is configured; it is rejected
  when `NODE_ENV=production`, so a deployment can never run with volatile sessions by accident.
- **The session payload** holds only the user id. The password hash is never serialised into it.
- **Sign out** (`POST /api/auth/logout`) destroys the server-side session and clears the cookie.
- **CSRF**: state-changing requests that carry the session cookie must come from the configured
  frontend origin; a request with a foreign `Origin` header is rejected with `403`. The check is
  skipped for requests without an `Origin` header (a plain API client), and requests without a
  session cookie are not vulnerable to CSRF in the first place.
- **CORS** allows exactly the configured origins with `credentials: true` — never `*`.

---

## 14. API reference

Base path: `/api`. The complete contract, including the request and response bodies of every
route, is in [docs/API.md](docs/API.md).

| Method | Route | Purpose | Auth | Authorisation |
|---|---|---|---|---|
| `GET` | `/health` | Liveness; `?database=true` also checks the database | none | — |
| `POST` | `/api/auth/register` | Create an account and sign in | none | — |
| `POST` | `/api/auth/login` | Sign in | none | — |
| `POST` | `/api/auth/logout` | Destroy the session | session | — |
| `GET` | `/api/auth/me` | The current user | session | — |
| `GET` | `/api/teams` | The teams of the caller, with the caller's role | session | — |
| `POST` | `/api/teams` | Create a team (the caller becomes owner) | session | — |
| `GET` | `/api/teams/:teamId` | One team | session | member |
| `PATCH` | `/api/teams/:teamId` | Rename / re-describe a team | session | owner |
| `DELETE` | `/api/teams/:teamId` | Delete a team with its memberships and tasks | session | owner |
| `GET` | `/api/teams/:teamId/members` | The members of a team | session | member |
| `POST` | `/api/teams/:teamId/members` | Add a registered user by email | session | owner |
| `DELETE` | `/api/teams/:teamId/members/:userId` | Remove a member, or leave the team | session | owner, or the member themselves |
| `GET` | `/api/teams/:teamId/invites` | The invitations of a team | session | member |
| `POST` | `/api/teams/:teamId/invites` | Record a pending invitation | session | owner |
| `DELETE` | `/api/teams/:teamId/invites/:inviteId` | Revoke a pending invitation | session | owner |
| `GET` | `/api/tasks` | Tasks of the caller's teams; filters: `teamId`, `assigneeId`, `status`, `search` | session | — (always scoped to the caller's teams) |
| `POST` | `/api/tasks` | Create a task | session | member of the team |
| `GET` | `/api/tasks/:taskId` | One task | session | member of the task's team |
| `PATCH` | `/api/tasks/:taskId` | Update title, description, status, due date, assignee | session | creator of the task or owner of the team |
| `DELETE` | `/api/tasks/:taskId` | Delete a task | session | creator of the task or owner of the team |
| `GET` | `/api/reminders` | Due dates of the caller: `overdue`, `today`, `upcoming` (7 days) | session | — |

Conventions:

- Successful responses are wrapped as `{ "data": { … } }`; errors as
  `{ "error": { "code": "…", "message": "…" } }` with an optional `details` array for field errors.
- A resource the caller may not see is answered with `404`, not `403`, so the existence of another
  team's data stays concealed. A `403` is used when the caller can see the resource but is not
  allowed to change it.
- `GET /api/tasks` accepts `teamId`, `assigneeId`, `status` (`todo`, `in_progress`, `done`) and
  `search` (matched case-insensitively against title and description).

---

## 15. Core workflows

**Sign up and sign in**
`AuthPages.jsx` validates the form in the browser, `AuthProvider` calls the API, the API hashes
the password, creates the session and answers `201`/`200` with the public user object. The
client stores the user in context and redirects to the dashboard.

**Create a team and add a member**
`TeamsPage.jsx` posts the team, the API creates the team and the owner's membership in one
transaction. The owner adds an existing account by email in `TeamPanel.jsx`; the API locates the
account by its normalised address, answers `404` for an unknown address and `409` for a duplicate
membership.

**Invite somebody without an account**
The owner records an invitation for an address. The response says `delivery: "stub"` and
`notificationSent: false`, because the invitation is a database row and no mail is sent. When that
address registers or signs in, the API turns every pending invitation of the address into a real
membership in one transaction, and the app shows a notice naming the team that was joined.

**Create and manage a task**
`TaskModal.jsx` posts the task. The API checks that the assignee is a member of the same team
and answers `400` otherwise; the database enforces the same rule. Editing and deleting are
restricted to the creator of the task and to the owner of the team.

**Filter and search**
`TaskFilters.jsx` keeps the filter state; `DashboardPage` turns it into query parameters and
reloads the list (with a 300 ms debounce for the search field). The SQL always joins the caller's
memberships, so the filters can only narrow the result.

**Sign out**
The client posts to `/api/auth/logout`, the API destroys the session in PostgreSQL and clears the
cookie; a later request to a protected route answers `401`.

---

## 16. Database schema

Full details, including the reasoning behind every constraint, are in
[docs/DATABASE.md](docs/DATABASE.md).

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `users` | Accounts | `id BIGSERIAL PK`, `name` (1–100 chars), `email UNIQUE`, `password_hash`, `created_at`, `updated_at` |
| `teams` | Teams | `id BIGSERIAL PK`, `name` (1–120 chars), `description`, `created_by → users(id) ON DELETE RESTRICT`, timestamps |
| `team_members` | Membership and role | `team_id → teams ON DELETE CASCADE`, `user_id → users ON DELETE CASCADE`, `role IN ('owner','member')`, `PRIMARY KEY (team_id, user_id)` |
| `tasks` | Tasks | `id BIGSERIAL PK`, `team_id → teams ON DELETE CASCADE`, `title` (1–200 chars), `description`, `assigned_to → users ON DELETE SET NULL`, `created_by → users ON DELETE RESTRICT`, `status IN ('todo','in_progress','done')`, `due_date DATE`, timestamps |
| `team_invites` | Pending invitations | `team_id → teams ON DELETE CASCADE`, `email`, `invited_by → users ON DELETE CASCADE`, `status IN ('pending','accepted','revoked')`, partial unique index on `(team_id, email) WHERE status = 'pending'` |
| `session` | Session store (`connect-pg-simple`) | `sid PK`, `sess json`, `expire`, index on `expire` |
| `schema_migrations` | Applied migrations | `name PK`, `applied_at` (created by the migration runner) |

Relationships and integrity rules:

- A user can be in many teams, a team has many members, and a team has many tasks.
- **The assignee of a task must be a member of the task's team.** This is a composite foreign
  key `fk_task_assignee_is_team_member (team_id, assigned_to) → team_members(team_id, user_id)`
  with `ON DELETE SET NULL (assigned_to)`: removing a member unassigns their tasks and keeps the
  tasks themselves.
- Deleting a team removes its memberships and its tasks (`ON DELETE CASCADE`).
- `updated_at` is kept up to date by a trigger on `users`, `teams` and `tasks`.
- The service layer runs the "create a team and its owner" and "accept an invitation" operations
  inside a transaction (`withTransaction`).

---

## 17. Bonus features

**BONUS-01 — due-date reminders.**
`GET /api/reminders` returns the tasks of the signed-in user that are assigned to them, are not
finished and have a due date, grouped into `overdue`, `today` and `upcoming` (the next 7 days),
with a count per group. The grouping is calculated by the database with `CURRENT_DATE`, so the
server and the database always agree on what "today" is, whatever the time zone of the browser is.
The **Reminders** panel on the dashboard shows the groups right after the sign in.
*Limitation:* the panel only lists reminders for the signed-in user; there is no notification for
a task that is not assigned to the current user, and no e-mail is sent.

**BONUS-02 — roles and permissions.**
`team_members.role` is either `owner` or `member`. The creator of a team is its owner. Owner-only
actions (add a member, rename the team, invite, revoke an invitation, delete the team) are
guarded by the `requireTeamOwner` middleware, and the interface renders the owner's actions only
for the owner. A task may be changed by the member who created it and by the owner of its team.
*Limitation:* there is no role beyond owner and member, and roles cannot be transferred.

**BONUS-03 — invitations by email (stub).**
`POST /api/teams/:teamId/invites` records a pending invitation for an address that does not need
an account yet. The response labels the stub explicitly (`delivery: "stub"`,
`notificationSent: false`), the interface lists the pending invitations, and the owner can revoke
one. When the invited address registers or signs in, the invitation becomes a real membership.
*Limitation:* no mail is sent — the invitation only exists in the database, and the invited
person has to be told out of band.

---

## 18. Testing, linting and production build

### The API test suite

```powershell
# working directory: server
npm test
```

- **90 tests** in five files: `auth.test.js` (24), `teams.test.js` (25), `tasks.test.js` (21),
  `invites.test.js` (11), `reminders.test.js` (9).
- The runner is the built-in `node:test` with `supertest`; the Express app is created in-process,
  so no port is bound.
- **The tests need their own database.** `server/test-support/database.js` derives the name
  `glacier_tasks_test` from `DATABASE_URL`, points the application at it before the configuration
  is read, applies the migrations and **truncates** `tasks`, `team_members`, `teams`,
  `team_invites`, `users` and `session` before every test. Create that database once
  (see [§10](#10-postgresql-setup)) and never use it for anything else. `TEST_DATABASE_NAME`
  changes the name.
- The suite covers the happy paths and the error paths: duplicate registration, wrong password,
  missing session, a task of a team the caller does not belong to, an assignee who is not a
  member of the team, a member trying to change somebody else's task, the owner rules, the
  invitation lifecycle and the reminder groups.

**Result of the run on 21 October 2026:** `tests 90`, `pass 90`, `fail 0`, 48 s.

### Client quality checks

```powershell
# working directory: client
npm run lint      # ESLint, exit code 0, no findings
npm run build     # production build, 50 modules transformed
```

**Result of the run on 21 October 2026:** lint exit code 0, build successful
(`dist/assets/index-*.js` ≈ 318 kB, `dist/assets/index-*.css` ≈ 19 kB).

### The live smoke test

`server/scripts/smoke-live.js` runs the whole flow against a deployed application: it registers
an account, signs out, checks that the protected routes answer `401`, signs in again, creates a
team, adds a second member, creates a task, applies the four filters, updates the task and signs
out.

```powershell
# working directory: server
$env:SMOKE_APP = "https://glacier-team-task-manager.web.app"
$env:SMOKE_API = "https://standings-exit-trainer-terminal.trycloudflare.com/api"
node scripts/smoke-live.js
```

**Result of the run on 21 October 2026:** `SMOKE TEST PASSED` (every step, including the session
cookie flags `HttpOnly; Secure; SameSite=None`).

The manual test plan and the recorded results are in [docs/TESTING.md](docs/TESTING.md).

---

## 19. Security

### Implemented

- **Passwords** are hashed with bcrypt (cost 12). Plaintext passwords are never stored, logged
  or returned.
- **SQL** is parameterised (`$1`, `$2`, …) in every query of every service. The search term of the
  task list escapes the wildcard characters `%`, `_` and `\`.
- **Validation** runs on the server for the body, the route parameters and the query parameters
  (`express-validator`); an invalid request is answered with `400` and a list of field errors.
- **Authentication** guards every route except `/health`, `POST /api/auth/register` and
  `POST /api/auth/login`. `requireAuth` answers `401` for a missing or invalid session.
- **Authorisation** is checked per resource: `requireTeamMember`, `requireTeamOwner`,
  `requireTaskAccess` and `requireTaskEditor`. A resource the caller may not see is answered with
  `404` so that it stays concealed.
- **The session** is `httpOnly`, has a finite lifetime, is `secure` in production and is stored
  in PostgreSQL. The session payload holds only the user id.
- **CSRF**: state-changing requests that carry the session cookie must come from the configured
  origin; a foreign `Origin` header is rejected with `403`.
- **CORS** allows exactly the configured origins with `credentials: true`.
- **Security headers** are set with `helmet`.
- **The error handler** never leaks a stack trace, SQL text or internal details; unexpected
  failures are logged server-side and answered with a generic `500`.
- **Secrets** are never committed: `.env` files are gitignored, `.env.example` files contain
  placeholders only, and the Docker build context excludes `.env`.

### Known limitations

- **No rate limiting** on the authentication endpoints. A password-guessing attack is not
  throttled.
- **No account lockout** and **no password reset** flow.
- **CSRF protection is an origin check, not a token.** It protects the browser case; a client
  that deliberately omits the `Origin` header is not subject to it.
- **No two-factor authentication.**
- **The invitation feature sends no email**; the invitation only exists in the database.
- The API answers `404` instead of `403` for resources the caller may not see. That hides
  existence, but it also means a legitimate client cannot distinguish "does not exist" from
  "not allowed".

---

## 20. Git and GitHub workflow

The repository uses a feature-branch workflow with real pull requests. The conventions are
described in [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

| Branch | Purpose |
|---|---|
| `main` | the protected integration branch |
| `feat/foundation-auth` | foundation, configuration and authentication |
| `feat/teams` | teams, members and roles |
| `feat/tasks` | tasks, assignment, filtering |
| `feat/bonuses` | reminders, roles and invitations |
| `feat/deployment` | the GCP deployment configuration |
| `feature/deployment-frontend` | the client deployment and the same-origin configuration |
| `docs/assessment-plan` | the documentation set of the assessment |
| `fix/assessment-compliance` | the last milestone: client-side validation, confirmation messages, a safer API client, the mobile navigation, the deployment verification and the rewritten README — merged into `main` |

The pull-request history is visible in the commit history of the repository: nine merge commits
(`Merge pull request #1` … `#9`) from `feat/teams`, `docs/assessment-plan`, `feat/tasks`,
`feat/bonuses`, `feat/deployment` and `feature/deployment-frontend`.

**Current state:** `main` contains every milestone. The branch `fix/assessment-compliance` was
merged into it with the merge commit `a103977` on 21 October 2026 — locally, not through a
pull request on GitHub, so the merge is not listed among the numbered pull requests above. The
working tree contains no uncommitted changes to tracked files. Every pull request is expected to
use the template in
[.github/pull_request_template.md](.github/pull_request_template.md).

---

## 21. Continuous integration

The workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and every
pull request against `main`, with one job per package:

| Job | Steps |
|---|---|
| **server** (Node 22) | `npm ci` → create the database `glacier_tasks_test` with `psql` → `npm test` with `DATABASE_URL` and `SESSION_SECRET` set for the job |
| **client** (Node 22) | `npm ci` → `npm run lint` → `npm run build` |

The API job uses a `postgres:16` service container with a health check, so the tests run against
a real PostgreSQL exactly as they do locally. The workflow does **not** deploy anything; the
deployment stays a deliberate, manual step.

The workflow has not been executed on GitHub for this repository — the checks were verified
locally instead (see [§18](#18-testing-linting-and-production-build)).

---

## 22. Deployment

### 22.1 The intended GCP architecture

| Part | Service | Configuration in the repository |
|---|---|---|
| Frontend | Firebase Hosting | `client/firebase.json` |
| API | Cloud Run (Node.js container) | `server/Dockerfile`, `deploy/cloud-run-api.yaml` |
| Database | Cloud SQL for PostgreSQL, reached through the Cloud SQL Auth Proxy sidecar | `deploy/cloud-run-api.yaml` |
| Secrets | Secret Manager (`glacier-api-secrets`) | `deploy/cloud-run-api.yaml` |
| Images | Artifact Registry | `deploy/deploy.ps1` |

The client and the API are **different origins**. The address of the API is compiled into the
browser bundle with `VITE_API_URL` at build time, the API allows the origin of the frontend in
`CLIENT_ORIGIN`, and the session cookie is therefore `SameSite=None; Secure; HttpOnly`.

Firebase Hosting can only forward a request to a Cloud Function or a Cloud Run container **of the
same project**, not to an arbitrary external URL. The `/api/**` rewrite to an external address
therefore does not work, and the only rewrite in `client/firebase.json` is the single-page
application fallback `**` → `/index.html`.

### 22.2 Deployment of the frontend (verified)

```powershell
# working directory: client
$env:VITE_API_URL = "https://<the address of the API>/api"
npm run build
firebase deploy --only hosting --project glacier-team-task-manager --non-interactive
```

The deployment uses the Application Default Credentials of `gcloud`, so no browser session of the
Firebase CLI is needed:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
```

### 22.3 Deployment of the API and the database (prepared, but blocked)

`deploy/deploy.ps1` performs the whole stack in one command:

```powershell
# working directory: repository root
.\deploy\deploy.ps1 -Check                                   # check the environment
.\deploy\deploy.ps1 -ProjectId PROJECT_ID -Region REGION     # deploy everything
```

The script creates the Artifact Registry repository, the Cloud SQL instance, the secret, builds
the image, deploys the Cloud Run service and then deploys the client to Firebase Hosting. The
exact commands, the expected output and the rollback steps are in
[docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md); the architecture and the reasoning are
in [docs/DEPLOYMENT_GCP.md](docs/DEPLOYMENT_GCP.md).

**Why it has not been executed:** the GCP account behind this project has **no billing account**,
and the billing account of the organisation cannot be linked to the project
(`billing.resourceAssociations.create` is denied). The only project with billing enabled denies
`run.services.create` for the account, and the account cannot change its own IAM roles. The
verified findings, with the exact error messages, are in
[docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) § 0.0.

The single action that unblocks the deployment is to link a billing account to the project
`glacier-team-task-manager` in the Google Cloud console, after which
`.\deploy\deploy.ps1 -ProjectId glacier-team-task-manager -Region asia-south1` deploys the API and
the database as well.

### 22.4 How the deployed application works today

Until the API can be hosted on GCP, the API of the developer machine is published through a
**Cloudflare quick tunnel**, and the client is built with the tunnel address:

```powershell
# 1. the API, in production mode, on 127.0.0.1:5000
#    working directory: server
$env:NODE_ENV = "production"
$env:PORT = "5000"
$env:SESSION_SAME_SITE = "none"
$env:CLIENT_ORIGIN = "https://glacier-team-task-manager.web.app"
$env:DATABASE_SSL = "false"
node src/server.js

# 2. the tunnel, in a second terminal
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:5000

# 3. the client, built against the tunnel address and deployed
#    working directory: client
$env:VITE_API_URL = "https://<the tunnel address>/api"
npm run build
firebase deploy --only hosting --project glacier-team-task-manager --non-interactive
```

A quick tunnel has no fixed address: it changes when the tunnel is restarted, and the client has
to be built and deployed again afterwards. The address of the application itself does not change.
This is a working but temporary arrangement — it is **not** a substitute for the Cloud Run
deployment above.

---

## 23. Current deployment status

| Item | Address / state | Verified |
|---|---|---|
| Deployed application | <https://glacier-team-task-manager.web.app> | yes — 21 October 2026, in a real browser: register, create a team, create a task, filter, sign out; the API answered `200`/`201`/`204` throughout |
| API of the deployment | <https://standings-exit-trainer-terminal.trycloudflare.com/api> | yes — `/health?database=true` answers `{"status":"ok","database":"up"}`; the live smoke test passed end to end |
| Repository | <https://github.com/SrRecode/team-task-manager> | yes — the `origin` remote of this checkout |
| API on Cloud Run | — | **no** — blocked by the missing billing account |
| Database on Cloud SQL | — | **no** — blocked by the missing billing account |

The deployed frontend serves the bundle built from the code that is now in `main`, with the API
address compiled in. After a new deployment, a browser tab that was already open keeps running
the previous bundle and therefore the previous API address — a hard reload (`Ctrl+Shift+R`) or a
private window fixes that.

---

## 24. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required…` on start | `server/.env` is missing or incomplete | `copy server\.env.example server\.env` and fill in the values |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running, or the port is wrong | start the PostgreSQL service, check the port in `DATABASE_URL` |
| `relation "users" does not exist` | The migrations were never applied | `cd server; npm run migrate` |
| The tests fail with `database "glacier_tasks_test" does not exist` | The test database is missing | `createdb -U glacier -O glacier glacier_tasks_test` |
| The tests report `permission denied for schema public` | The role may not own the database | `ALTER DATABASE glacier_tasks_test OWNER TO glacier;` |
| `Request origin is not allowed` (403) | The browser sent a different `Origin` than `CLIENT_ORIGIN` | set `CLIENT_ORIGIN` to the exact origin of the client, e.g. `http://localhost:5173` |
| The browser reports *"The API answered with a response the application does not understand"* | The client called the wrong base URL — usually a stale bundle that still points at `/api` on the hosting origin, or a `VITE_API_URL` without the `/api` suffix | hard reload the page, and check that `VITE_API_URL` ends with `/api` |
| The sign-in succeeds but the next request is not authenticated | The cookie was rejected | for a cross-site setup use `SESSION_SAME_SITE=none` and `NODE_ENV=production` (so the cookie is `Secure`); for a same-site setup keep `lax` |
| `firebase` is not recognised | The Firebase CLI is not installed globally | `npm install -g firebase-tools`, or use `npx firebase-tools …` |
| The deployed site shows the previous version | The browser cached the old bundle | hard reload (`Ctrl+Shift+R`) or open the site in a private window |
| A `package.json` appears in the repository root | It is a local, untracked Playwright harness, not part of the repository | the tracked repository has no root `package.json`; the client and the server are installed separately |

---

## 25. Documentation index

Every file below exists in the repository.

| Document | Content |
|---|---|
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | the milestone plan and the delivery strategy |
| [docs/ASSESSMENT_REQUIREMENTS.md](docs/ASSESSMENT_REQUIREMENTS.md) | the assessment requirements, the bonuses and the evidence for each of them |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | the system architecture |
| [docs/API.md](docs/API.md) | the REST contract with request and response bodies |
| [docs/DATABASE.md](docs/DATABASE.md) | the database design and the constraints |
| [docs/SECURITY.md](docs/SECURITY.md) | the security baseline |
| [docs/FRONTEND.md](docs/FRONTEND.md) | the frontend implementation guide |
| [docs/BACKEND.md](docs/BACKEND.md) | the backend implementation guide |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | the environment variable rules |
| [docs/TESTING.md](docs/TESTING.md) | the test plan and the recorded results |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | the branch and pull-request conventions |
| [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) | the AI-assisted development workflow |
| [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md) | what "done" means for this project |
| [docs/DEPLOYMENT_GCP.md](docs/DEPLOYMENT_GCP.md) | the intended GCP deployment |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | the step-by-step deployment runbook, including the verified blockers |
| [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | the audit of the repository at the start of the project |
| [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) | the checklist before sending the submission |
| [docs/SUBMISSION_MESSAGE.md](docs/SUBMISSION_MESSAGE.md) | the ready-to-send submission message |
| [docs/design/ui-mockup.html](docs/design/ui-mockup.html) | the static UI mockup of the design |
| [deploy/deploy.ps1](deploy/deploy.ps1) | the one-command deployment script |
| [server/scripts/smoke-live.js](server/scripts/smoke-live.js) | the end-to-end script for a deployed application |

> Note: `client/README.md` is still the text of the Vite template. This file is the documentation
> of the project.

---

## 26. Assessment submission checklist

- [x] The repository builds and runs from a clean clone with the instructions in [§8](#8-installation)–[§12](#12-running-the-application-locally).
- [x] The API test suite passes: 90 of 90.
- [x] The client lints and builds without findings.
- [x] The deployed application is reachable and was verified in a real browser and with the live smoke test.
- [x] The API of the deployment answers `/health?database=true` with `{"status":"ok","database":"up"}`.
- [x] The Git history contains real feature branches and pull requests (#1 … #9).
- [x] The environment variables are documented and contain no secrets.
- [ ] The API and the database run on Cloud Run and Cloud SQL — **blocked by the missing billing account**; the prepared configuration and the exact blocker are documented in [§22.3](#223-deployment-of-the-api-and-the-database-prepared-but-blocked).
- [x] The branch `fix/assessment-compliance` is merged into `main` (merge commit `a103977`); every milestone is part of the default branch.

Links for the submission:

| Link | Address |
|---|---|
| Deployed application | <https://glacier-team-task-manager.web.app> |
| API (for verification) | <https://standings-exit-trainer-terminal.trycloudflare.com/api> |
| Repository | <https://github.com/SrRecode/team-task-manager> |

The ready-to-send message and the pre-send checklist are in
[docs/SUBMISSION_MESSAGE.md](docs/SUBMISSION_MESSAGE.md) and
[docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md). Send working links, not
placeholders.

---

## 27. Limitations and next steps

**Limitations of the current build**

1. The API and the database are not hosted on GCP. The configuration is complete and tested
   locally, but the account has no billing account and cannot create a Cloud Run service.
2. The deployed application depends on the developer machine through a Cloudflare quick tunnel,
   whose address changes on every restart.
3. No rate limiting, account lockout, password reset or two-factor authentication.
4. Invitations are database records; no email is sent.
5. The CSRF protection is an origin check instead of a token.
6. The task list has no pagination; a team with a very large number of tasks loads all of them.
7. The last milestone was merged into `main` with a local merge commit, so it does not appear as
   a numbered pull request in the GitHub history the way the previous milestones do.

**Next steps**

1. Link a billing account to the GCP project and run `.\deploy\deploy.ps1` to move the API to
   Cloud Run and the database to Cloud SQL; then rebuild the client with the `run.app` address
   and deploy it again.
2. Open a pull request for the remaining documentation work, so that every future change follows
   the pull-request workflow of the earlier milestones.
3. Add rate limiting (`express-rate-limit`) and a password reset flow.
4. Replace the invitation stub with a real transactional mail provider.
5. Add pagination and server-side sorting to the task list, and a Swagger/OpenAPI document
   generated from the route definitions.
6. Add a seeded demo dataset so that a reviewer can sign in with a ready-made account.
