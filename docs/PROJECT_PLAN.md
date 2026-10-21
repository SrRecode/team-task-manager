# Project Plan and 72-Hour Delivery Strategy

## Current status (updated 2026-10-21)

**Branch:** `feat/foundation-auth` (implementation), `docs/assessment-plan` (this documentation set)
**Milestone completed:** M0 (audit) and M1 (secure foundation + authentication)

### Done and verified

- **M0 - Audit.** `docs/AUDIT_REPORT.md` records the state of the starting point with the
  evidence for every finding. The backend was two 0-byte files, the frontend rendered an
  empty page, and `passwort` (SHA1) was installed in place of `passport`.
- **M1 - Foundation and auth.** A real Express application with Passport local strategy,
  bcrypt password hashing, PostgreSQL-backed sessions, server side validation, a CSRF
  origin check and a working React sign in / sign up flow.
- `server/package.json` no longer contains `passwort`, `i` or `npm`. 141 packages, 0 vulnerabilities.
- PostgreSQL schema and an ordered migration runner, with the assignee invariant enforced by a
  composite foreign key.
- 24 automated tests, all passing: `cd server && npm test`.
- `cd client && npm run lint` exits 0 and `cd client && npm run build` succeeds.
- Verified by hand in a browser: register, sign in, session survives a page reload, sign out,
  and the protected route redirects an unauthenticated visitor to the sign in screen.

### Current test results

| Command | Result |
|---|---|
| `cd server && npm test` | 24 passed, 0 failed |
| `cd client && npm run lint` | exit 0, no problems |
| `cd client && npm run build` | exit 0, 34 modules transformed |
| `cd server && npm run migrate` | 1 migration applied, idempotent on re-run |

### Blockers

- The GitHub CLI is installed but still needs `gh auth login` before pull requests can be opened.
- GCP deployment is not started. No Cloud SQL instance, no Cloud Run service, no hosting
  configuration exists yet.

### Next action

**M2 - Teams.** Create, list, get, update and delete teams, add and remove members, and enforce
owner and member permissions on the server. This is the next smallest vertical slice, and it
unblocks REQ-02, REQ-03 and the role checks that REQ-21 depends on.

## Objective

Deliver a working, secure Team Task Manager that meets the mandatory requirements in `ASSESSMENT_REQUIREMENTS.md`. Prioritize functionality, correctness, readable code, and deployment over optional polish.

## Delivery principles

1. Build vertical slices: database → API → UI → test.
2. Keep the application small and understandable.
3. Integrate frontend and backend early.
4. Commit working milestones; use real feature branches and pull requests.
5. Keep optional features out of the critical path.
6. Reserve the final portion of the deadline for deployment, testing, documentation, and submission.

## Suggested 72-hour schedule

| Window | Goal | Exit criteria |
|---|---|---|
| 0–4 hours | Inspect repository, setup, architecture, GitHub | Client/server run; initial commit and first feature branch exist |
| 4–12 hours | Schema, migrations, DB connection, auth | Register/login/logout/current-user endpoint works; session stored correctly |
| 12–22 hours | Teams and membership | Create/list/update/delete teams as authorized; add/list members |
| 22–32 hours | Task API | Task CRUD, assignment checks, filters and validation work |
| 32–44 hours | Frontend integration | Auth pages, dashboard, teams, task modal and filters call real APIs |
| 44–52 hours | Security and tests | Negative tests, authorization tests and regression pass |
| 52–64 hours | GCP deployment | Frontend, API and database connected over secure configuration |
| 64–72 hours | Final QA and submission | README complete, PR history visible, live smoke test passes, URLs ready |

This schedule is a planning target, not a guarantee. If the current repository already has working pieces, audit and reuse them rather than rebuilding them.

## Milestones

### M0 — Audit and stabilize
- Inspect Git status, branches, package files and existing code.
- Record implemented, partial, broken and missing features.
- Avoid deleting or overwriting work before understanding it.

### M1 — Foundation
- Establish frontend and backend commands.
- Establish environment configuration and database migrations.
- Add health endpoint and consistent error handling.

### M2 — Authentication
- Registration, login, logout and current-user endpoint.
- bcrypt password hashing.
- Passport Local Strategy and Express sessions.
- PostgreSQL session store outside local-only fallback.

### M3 — Teams
- Create/list/get/update/delete team.
- Add/list/remove team members.
- Enforce owner/member permissions server-side.

### M4 — Tasks
- Create/list/get/update/delete task.
- Validate task team and assignee relationship.
- Filter by team, assignee, status and search term.

### M5 — Frontend
- Login and registration.
- Dashboard and team list.
- Task create/update modal.
- Filters, loading states, empty states, errors and responsive layout.

### M6 — Verification
- Test successful and rejected flows.
- Test cross-team and cross-user access.
- Run build, tests and lint if configured.
- Resolve deployment blockers.

### M7 — Release
- Deploy database, API and frontend to GCP.
- Verify session cookies and CORS on production domains.
- Update README with actual setup and deployed URL.
- Verify GitHub branches/PRs and send the submission.

## Scope control

**Must ship:** auth, teams, team members, task CRUD/assignment, filters, validation, PostgreSQL sessions, GitHub branch/PR evidence, GCP deployment and setup documentation.

**Only if time remains:** due-date reminders, email invite stub, extra analytics, drag-and-drop Kanban, notifications, avatars, advanced UI animation.

## Daily working loop

1. Select one small acceptance criterion.
2. Inspect relevant code.
3. Implement the smallest coherent change.
4. Run targeted tests.
5. Manually verify the flow.
6. Review `git diff`.
7. Commit and push the feature branch.
8. Open/update the pull request.
9. Update docs and this plan.
