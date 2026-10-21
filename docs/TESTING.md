# Testing and Quality Assurance

## 1. Goals

Test required behavior, integration, authorization and the production deployment. A passing happy-path demo is not sufficient for session-based security.

## 2. Test layers

- **Unit tests:** validation helpers and domain logic where useful.
- **API/integration tests:** Express routes with a test database or isolated test setup; Supertest can exercise HTTP behavior.
- **Frontend tests:** form validation and key UI behavior with the project's selected React test tools.
- **Manual end-to-end tests:** browser workflows against local and deployed environments.

Use tools already configured in the repository where possible. Do not add a large test stack if it jeopardizes the deadline.

## 3. Critical test matrix

| Area | Scenario | Expected result |
|---|---|---|
| Register | Valid details | Account created; password hash stored |
| Register | Duplicate email | Clear conflict response |
| Register | Invalid email/short or invalid password | Validation error |
| Login | Correct credentials | Session established |
| Login | Incorrect credentials | Generic 401; no authenticated session |
| Session | Refresh browser after login | Session remains valid according to configuration |
| Logout | Valid session | Session destroyed; later protected request rejected |
| Auth | No session calls protected API | 401 |
| Team | Create team | Team and owner membership created atomically |
| Team | List teams | Only current user's memberships returned |
| Team | Non-owner deletes team | Denied |
| Membership | Add registered user | Membership created |
| Membership | Add duplicate membership | Conflict or idempotent documented response |
| Task | Create valid task | 201 and stored task |
| Task | Assign user outside team | Rejected |
| Task | Access task from unrelated team | Denied or concealed |
| Task | Invalid status | 400 |
| Task | Update/delete without permission | Denied |
| Filter | Team and assignee filters together | Correct accessible subset |
| Reminder | Task of the user is due today | Listed in the `today` group of the dashboard |
| Reminder | Task is finished or has no due date | Not a reminder |
| Reminder | Task of somebody else | Not a reminder |
| Invitation | Owner invites an unregistered address | 201 and a pending invitation, labelled as a stub |
| Invitation | Member tries to invite | Denied |
| Invitation | The invited address registers | The user becomes a member of the team |
| Invitation | The same address is invited twice | Conflict |
| SQL safety | Malicious-looking input | Treated as data, not SQL |
| Frontend | API fails | Clear error state |
| Frontend | No tasks | Useful empty state |
| Responsive | Mobile viewport | Controls remain usable |
| Deployment | Live register/login/task flow | End-to-end workflow succeeds |

## 4. Manual end-to-end test

Use at least two test users:
1. Register User A.
2. Register User B.
3. Log in as User A and create Team A.
4. Add User B to Team A.
5. Create a task assigned to User B.
6. Verify the task appears in Team A and filters work.
7. Attempt invalid assignment to a non-member; confirm rejection.
8. Create an unrelated team/user and verify cross-team access is denied.
9. Test edits, status updates and authorized deletion.
10. Log out and verify protected requests fail.
11. Repeat the main flow against the deployed URL.

### Bonus flows

Reminders (BONUS-01):

1. Sign in as User A, who has a task with a due date of today and one that is
   overdue.
2. Open the dashboard: both tasks are listed in the **Reminders** panel, in the
   `Due today` and `Overdue` groups.
3. Change the status of a task to `done` and confirm that it disappears from
   the panel.

Invitations (BONUS-03):

1. Sign in as User A, open Team A and record an invitation for an address that
   has no account.
2. Confirm that the invitation is listed as pending and that the notice says
   that no email was sent.
3. Register an account with that address: the user is a member of Team A and
   the app shows the notice that the team was joined because of the
   invitation.
4. Sign in as a member of Team A and confirm that recording an invitation is
   not possible.

Do not use real personal data or production credentials in test fixtures.

## 5. Before each PR

```powershell
git diff --check
```

Then run the scripts actually defined in the relevant `package.json`, such as tests, lint and build. Do not claim commands passed unless they were run successfully.

## 6. Before submission

- [ ] Clean install works using documented steps.
- [ ] Migrations work on a fresh database.
- [ ] No secrets are tracked by Git.
- [ ] Production build succeeds.
- [ ] All mandatory flows pass.
- [ ] Authorization negative tests pass.
- [ ] Live app works in a fresh browser session.
- [ ] Browser console and server logs have no unresolved critical errors.
