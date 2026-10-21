# Assessment Requirements and Traceability

This document converts the supplied *Full Stack Development Assessment* into verifiable implementation requirements. The assessment is the source of truth for mandatory scope. Recommendations are labeled as implementation guidance.

## 1. Assessment summary

The assessment evaluates:
1. Reading and comprehension skills.
2. Frontend and backend development skills.
3. Code neatness and ease of understanding for external developers.
4. Time management skills.

The task is to build a Team Task Manager web application.

## 2. Mandatory requirements

| ID | Requirement from assessment | Implementation evidence | Verification |
|---|---|---|---|
| REQ-01 | Secure registration and login | Register/login forms and auth API | Register, log in, log out, invalid credentials |
| REQ-02 | Create and manage teams | Team UI, routes, service, database tables | Create/read/update/delete with permission checks |
| REQ-03 | Add members to teams | Team membership API and UI | Add a registered user; reject invalid or unauthorized actions |
| REQ-04 | Create, assign, and manage team tasks | Task forms, API and database | CRUD task; assign only a member of the same team |
| REQ-05 | Filter tasks by team or assigned members | Search/filter UI and API query parameters | Verify filters return only accessible matching tasks |
| REQ-06 | React + Tailwind CSS + Vite | Client app and dependency configuration | Build succeeds |
| REQ-07 | Login/register form | Auth pages | Manual UI and API checks |
| REQ-08 | Dashboard with team list and task list | Dashboard page | Check empty and populated states |
| REQ-09 | Task create/update modal | Reusable task form modal | Create and edit task |
| REQ-10 | Search/filter tasks by team or assignee | Filter controls and query handling | Filter combinations |
| REQ-11 | Clean, responsive UI | Responsive layouts and accessible controls | Test mobile and desktop widths |
| REQ-12 | Node.js + Express | Server app | Server starts and health endpoint responds |
| REQ-13 | RESTful CRUD routes for `/auth`, `/teams`, `/tasks` | API routes | API tests and API documentation |
| REQ-14 | Validation with Joi or express-validator | Request schemas/middleware | Invalid body/query/path returns 400 |
| REQ-15 | PassportJS + Express Session | Passport Local Strategy and session middleware | Session persists between requests |
| REQ-16 | Store session in PostgreSQL; memory fallback in development | `connect-pg-simple` in deployed setup; explicitly development-only memory fallback if used | Restart API and check session behavior |
| REQ-17 | HTTP-only cookies | Cookie configuration | Inspect browser cookie flags |
| REQ-18 | Protect all non-auth routes | Auth middleware on protected routes | Unauthenticated requests fail |
| REQ-19 | Database service available on GCP | GCP-hosted PostgreSQL, preferably Cloud SQL | Verify live API database connection |
| REQ-20 | Git and GitHub, with branch or PR history | Feature branches, commits and real PRs | Review GitHub history |
| REQ-21 | Auth middleware restricts access | `requireAuth` and resource-level authorization | Cross-user/team access tests |
| REQ-22 | Input validation and sanitization | Validation schemas and safe output handling | Invalid input tests |
| REQ-23 | No plaintext passwords; use bcrypt | `password_hash` and bcrypt comparison | Inspect schema/code; test login |
| REQ-24 | Working code: frontend + backend | Repository | Clean setup and build/test |
| REQ-25 | Setup instructions | README and docs | Another developer follows setup |
| REQ-26 | Deployed version on GCP | Public frontend and live backend/database | End-to-end smoke test |
| REQ-27 | Send deployed and repository links via Indeed | Final submission message | Confirm both links are correct |

## 3. Optional bonus requirements

These are optional in the assessment and must not delay the mandatory features.

| ID | Bonus | Minimum viable implementation | Status in this repository |
|---|---|---|---|
| BONUS-01 | Task due-date reminders (login only) | In-app reminder display for authenticated user; avoid unnecessary email infrastructure | Implemented: `GET /api/reminders` and the **Reminders** panel on the dashboard (`server/src/modules/reminders/`, `client/src/components/reminders/ReminderPanel.jsx`), tested in `server/test/reminders.test.js` |
| BONUS-02 | Role-based access, e.g. only team creators can delete teams | Owner/member roles and server-side permission checks | Implemented: the `role` column of `team_members`, the `requireTeamOwner` middleware and the owner/member checks of the team routes, tested in `server/test/teams.test.js` |
| BONUS-03 | Invite members by email (stubbed; SMTP not required) | Validate email and create a clearly labeled invite stub or pending invitation record | Implemented: `POST /api/teams/:teamId/invites` with the `team_invites` table, the response labels the stub (`delivery: "stub"`, `notificationSent: false`) and the invitation becomes a membership when the address registers or signs in, tested in `server/test/invites.test.js` |

## 4. Assessment exclusions and assumptions

The assessment does not specify:
- A required UI design system beyond React, Tailwind, Vite and a clean responsive UI.
- A required ORM or migration library.
- A required testing framework.
- A required exact database schema.
- A requirement for JWT authentication; it explicitly asks for PassportJS and Express Session.
- A requirement for real email delivery; the invitation bonus can be stubbed.
- A requirement for real-time updates or a Kanban board.

Do not add these as mandatory scope without a reason.

## 5. Requirement acceptance criteria

A requirement is complete only when:
1. Its implementation exists.
2. Its expected behavior has been tested.
3. Authorization and error paths have been considered.
4. Documentation reflects the actual behavior.
5. Its code is committed and reviewed through the agreed Git workflow.

## 6. Evidence to preserve

- GitHub repository URL.
- Real feature branches and pull requests.
- Screenshots only if useful; they do not replace a working deployed app.
- Test output and build results.
- Deployed URL.
- Setup instructions and environment-variable documentation.
