# Backend Implementation Guide

## 1. Stack and responsibilities

- Node.js + Express.
- `pg` connection pool for PostgreSQL.
- Passport Local Strategy.
- `express-session` and PostgreSQL session store.
- bcrypt.
- Joi or express-validator.
- Helmet and deliberate CORS configuration.

## 2. Suggested structure

```text
server/src/
├── config/
│   ├── database.js
│   ├── passport.js
│   └── session.js
├── db/
│   ├── migrations/
│   └── seed.js
├── middleware/
│   ├── requireAuth.js
│   ├── validate.js
│   ├── requireTeamMember.js
│   └── errorHandler.js
├── modules/
│   ├── auth/
│   ├── teams/
│   └── tasks/
├── app.js
└── server.js
```

## 3. Middleware order

Recommended high-level order:
1. Security headers.
2. Request body parsers with size limits.
3. CORS configured for the actual client origin.
4. Session middleware with the correct store and cookie settings.
5. Passport initialization and session middleware.
6. Health endpoint.
7. Authentication, team and task routers.
8. Not-found handler.
9. Central error handler.

Confirm middleware ordering against the selected packages and the deployed topology. CSRF middleware or checks must be integrated before state-changing routes.

## 4. Database connection

- Use a `pg.Pool`.
- Read connection settings from environment variables.
- Handle connection failures safely.
- Close the pool during graceful shutdown.
- Use parameterized queries.
- Do not create a new pool per request.
- Configure Cloud SQL connectivity according to the chosen GCP setup.

## 5. Authentication implementation

- Validate registration input.
- Normalize email.
- Hash password with bcrypt using an appropriate work factor.
- Handle unique-email conflicts cleanly.
- Configure Passport Local Strategy to query the user and compare with bcrypt.
- Serialize the minimum user identity into the session.
- Deserialize safely, handling deleted/disabled users.
- Regenerate session after successful login.
- Destroy session on logout.
- Return a safe user object only.

## 6. Authorization service rules

### Team creation
Within a transaction:
1. Insert team using the authenticated user's ID.
2. Insert an owner row into `team_members`.
3. Commit both together.

### Add member
1. Require authenticated owner or authorized manager.
2. Validate and normalize target email.
3. Find an existing registered user.
4. Insert membership, handling duplicate membership.
5. Return a safe member representation.

### Task creation/assignment
1. Validate title, status, team ID and optional assignee.
2. Confirm current user belongs to team.
3. If assignee is supplied, confirm that user belongs to the same team.
4. Insert using parameterized SQL.
5. Return the created task without sensitive fields.

### Task update/delete
1. Load task through a query scoped to an accessible team.
2. Check the caller's permission for the operation.
3. Validate changed fields and assignee relationship.
4. Apply update/delete with parameterized SQL.
5. Return an appropriate status and response.

## 7. Error handling

Use one centralized error handler. Distinguish expected validation, authentication, permission, not-found and conflict errors from unexpected exceptions. Log useful server-side diagnostics without secrets; return safe client messages.

## 8. Health endpoint

Provide a lightweight endpoint such as `GET /health` for deployment checks. It should not disclose environment variables, database credentials, or sensitive infrastructure details. If checking the database, return only a safe healthy/unhealthy status.

## 9. Backend acceptance checklist

- [ ] Server starts from documented command.
- [ ] Database connection is pooled and configured from environment.
- [ ] Migrations apply repeatably.
- [ ] Authentication routes work.
- [ ] Session is persisted in PostgreSQL for deployed use.
- [ ] Team and task routes validate inputs.
- [ ] Every protected operation checks authorization.
- [ ] Assignee/team consistency is enforced.
- [ ] SQL is parameterized.
- [ ] Errors are handled centrally.
- [ ] Tests cover positive and negative cases.
