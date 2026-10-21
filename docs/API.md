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
| GET | `/teams/:teamId/invites` | Yes + membership | List the invitations of a team |
| POST | `/teams/:teamId/invites` | Yes + owner permission | Record an invitation for an address |
| DELETE | `/teams/:teamId/invites/:inviteId` | Yes + owner permission | Revoke a pending invitation |

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

### Invitations (BONUS-03)

There is no mail server in this build, so an invitation is a record in the
database instead of a message. The address does not have to belong to a
registered account. The invitation becomes a membership when the invited
address registers an account or signs in, and the response of the register and
login routes reports the invitations that were accepted.

Create invitation request:

```json
{
  "email": "invitee@example.com"
}
```

Create invitation response:

```json
{
  "data": {
    "invite": {
      "id": 4,
      "teamId": 3,
      "teamName": "Assessment Team",
      "email": "invitee@example.com",
      "invitedBy": 1,
      "invitedByName": "Ayesha Khan",
      "status": "pending",
      "createdAt": "2026-10-21T09:00:00.000Z",
      "acceptedAt": null,
      "delivery": "stub",
      "notificationSent": false
    }
  }
}
```

- `delivery: "stub"` and `notificationSent: false` state explicitly that no
  email was sent.
- A second pending invitation for the same team and address is a `409`.
- Inviting somebody who is already a member is a `409`.
- Only the owner may create and revoke an invitation; any member may read the
  list.

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

## 5. Reminders (BONUS-01)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/reminders` | Yes | The due-date reminders of the signed in user |

A reminder is a task that is assigned to the signed in user, is not finished
and has a due date. The groups are calculated by the database (`CURRENT_DATE`),
so the server and the database always agree on what "today" is.

```json
{
  "data": {
    "reminders": {
      "reminders": {
        "overdue": [],
        "today": [],
        "upcoming": [
          {
            "id": 9,
            "teamId": 3,
            "teamName": "Assessment Team",
            "title": "Write the release notes",
            "status": "todo",
            "dueDate": "2026-10-24"
          }
        ]
      },
      "counts": { "overdue": 0, "today": 0, "upcoming": 1, "total": 1 },
      "windowDays": 7
    }
  }
}
```

- `overdue`: the due date has passed.
- `today`: the due date is today.
- `upcoming`: the due date is within `windowDays` days.
- A task without a due date and a finished task are never a reminder.
- The reminder only contains tasks of the teams the caller belongs to.

## 6. HTTP status guidance

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

## 7. Security requirements for every route

- Validate path parameters, query parameters and request body.
- Require authentication and resource-level authorization.
- Scope reads and mutations to accessible teams.
- Use parameterized SQL.
- Never accept `createdBy` or owner identity from the client as authoritative; derive it from the session.
- Verify assignee is a member of the same team.
- Do not trust a role sent by the browser.
- Return only fields needed by the client.
