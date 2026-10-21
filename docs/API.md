# REST API Contract

Base path: `/api`

All endpoints return JSON unless a successful delete uses `204 No Content`. Every endpoint except the authentication endpoints intended to establish/recover session state must require a valid authenticated session. The current-user endpoint requires authentication.

## 1. Common response conventions

Success example:

```json
{
  "data": {
    "id": 12,
    "title": "Prepare assessment demo"
  }
}
```

Error example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

Do not expose internal SQL errors, stack traces, password hashes, session identifiers, or secrets.

## 2. Authentication

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | No existing session required | Register user and establish session if chosen |
| POST | `/auth/login` | No | Authenticate and establish session |
| POST | `/auth/logout` | Yes | Destroy session and clear cookie |
| GET | `/auth/me` | Yes | Return current user's safe public profile |

Register request:

```json
{
  "name": "Ayesha Khan",
  "email": "ayesha@example.com",
  "password": "a-long-user-chosen-password"
}
```

Login request:

```json
{
  "email": "ayesha@example.com",
  "password": "a-long-user-chosen-password"
}
```

Rules:
- Normalize email consistently.
- Validate all inputs.
- Hash passwords with bcrypt before storage.
- Use generic login failure messages to reduce account enumeration.
- Regenerate session ID after authentication.
- Never return `password_hash`.

## 3. Teams

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/teams` | Yes | List teams current user belongs to |
| POST | `/teams` | Yes | Create a team and membership for creator |
| GET | `/teams/:teamId` | Yes | Get accessible team |
| PATCH | `/teams/:teamId` | Yes + permission | Update team |
| DELETE | `/teams/:teamId` | Yes + owner permission | Delete team |
| GET | `/teams/:teamId/members` | Yes + membership | List members |
| POST | `/teams/:teamId/members` | Yes + owner permission | Add existing registered user |
| DELETE | `/teams/:teamId/members/:userId` | Yes + permission | Remove member |

Create team request:

```json
{
  "name": "Assessment Team",
  "description": "Team task planning"
}
```

Add member request:

```json
{
  "email": "member@example.com"
}
```

The add-member route should locate an existing registered user by normalized email, reject unknown users, and avoid duplicate membership. Do not expose user enumeration data to unauthorized callers.

Creating a team should create its owner membership atomically.

## 4. Tasks

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/tasks` | Yes | List tasks from accessible teams with filters |
| POST | `/tasks` | Yes + team membership | Create task |
| GET | `/tasks/:taskId` | Yes + team membership | Get task |
| PATCH | `/tasks/:taskId` | Yes + permission | Update task |
| DELETE | `/tasks/:taskId` | Yes + permission | Delete task |

Create task request:

```json
{
  "teamId": 3,
  "title": "Review pull request",
  "description": "Check the API tests",
  "assignedTo": 7,
  "status": "todo",
  "dueDate": null
}
```

Supported filters:

`GET /api/tasks?teamId=3&assigneeId=7&status=todo&search=review`

- `teamId`: optional positive integer.
- `assigneeId`: optional positive integer.
- `status`: `todo`, `in_progress`, or `done`.
- `search`: optional bounded string; search title and/or description.
- All filters must be combined with the authenticated user's team access constraints.

Task update should allow only documented fields. Verify the task exists and is accessible before mutation. If `teamId` is mutable, validate all related team and assignee rules; alternatively, keep a task's team immutable to simplify safe behavior.

## 5. HTTP status guidance

| Status | Use |
|---|---|
| 200 | Successful read/update |
| 201 | Resource created |
| 204 | Successful delete/logout where appropriate |
| 400 | Invalid input or malformed request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated user lacks permission |
| 404 | Resource absent or intentionally concealed |
| 409 | Duplicate email or conflicting membership |
| 500 | Unexpected server error |

## 6. Security requirements for every route

- Validate path parameters, query parameters and request body.
- Require authentication and resource-level authorization.
- Scope reads and mutations to accessible teams.
- Use parameterized SQL.
- Never accept `createdBy` or owner identity from the client as authoritative; derive it from the session.
- Verify assignee is a member of the same team.
- Do not trust a role sent by the browser.
- Return only fields needed by the client.
