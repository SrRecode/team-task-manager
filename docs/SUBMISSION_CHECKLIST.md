# Final Assessment Submission Checklist

The assessment requests a GitHub repository containing working frontend/backend code and setup instructions, a deployed version on GCP, and submission of the deployed link and repository link through Indeed.

## 1. Repository
- [x] Repository is accessible to the evaluator.
- [x] Frontend and backend source are included.
- [x] No credentials or `.env` files are committed.
- [x] README provides accurate local setup instructions.
- [x] Environment variables are documented.
- [x] Database migration instructions are included.
- [x] GitHub branch or pull-request history is visible.
- [x] Code is readable and logically organized.

## 2. Required functionality
- [x] Register and log in securely.
- [x] Create and manage teams.
- [x] Add team members.
- [x] Create, assign, update and delete tasks.
- [x] Filter tasks by team and assigned member.
- [x] Dashboard displays team and task lists.
- [x] Task create/update modal works.
- [x] UI is responsive.
- [x] Validation and server-side authorization work.
- [x] Passwords are bcrypt-hashed.
- [ ] Sessions are stored in PostgreSQL in deployment. — the session store is
      PostgreSQL in every environment that has a `DATABASE_URL`, and the
      deployed API runs with one. It can only be confirmed on the live
      deployment, which waits for the billing account.
- [x] Non-auth routes are protected.

The functionality was verified in a browser on 21 October 2026, the step by
step result is in [TESTING.md](TESTING.md) § "What was verified on 21 October
2026".

## 3. Deployment
- [x] Public frontend URL works — <https://glacier-team-task-manager.web.app>.
- [x] API URL works. — <https://standings-exit-trainer-terminal.trycloudflare.com/api>,
      the API of the deployed application. It is published through a Cloudflare
      quick tunnel, because a Cloud Run service needs a billing account on the
      project, see [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) § 0.0.
- [x] Production database is reachable by the API. — PostgreSQL 18, database
      `glacier_tasks`; `/health?database=true` answers
      `{"status":"ok","database":"up"}`. A Cloud SQL instance needs the same
      billing account.
- [x] HTTPS and session cookies work. — the cookie of the live deployment is
      `HttpOnly`, `Secure`, `SameSite=None`, `Path=/`.
- [x] CORS and CSRF protections work in the deployed topology. — the client
      calls the API on its own origin, the browser sends the `Origin` header of
      the frontend, and the origin check of the server accepts it.
- [x] Fresh account can complete the full flow. — verified on 21 October 2026
      against <https://glacier-team-task-manager.web.app>, see
      [TESTING.md](TESTING.md) § "The live run of 21 October 2026".
- [x] No critical browser or server errors. — the only console entry of the
      live run is the `401` of the session probe of the login page.
- [x] GCP billing/pricing has been checked. — the footprint is `db-f1-micro`
      and a Cloud Run service that scales to zero, see
      [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) § 14.

## 4. Final links

- **Deployed application:** <https://glacier-team-task-manager.web.app> —
  verified on 21 October 2026
- **API (for verification):** <https://standings-exit-trainer-terminal.trycloudflare.com/api>
- **GitHub repository:** <https://github.com/SrRecode/team-task-manager> — verified,
  this is the `origin` remote of the repository.

The API address is the address of the quick tunnel and changes when the tunnel
is restarted; the address of the application does not change. The complete
submission message, with a pre-send verification checklist, is in
[SUBMISSION_MESSAGE.md](SUBMISSION_MESSAGE.md).

## 5. Submission message

```text
Hello,

I have completed the Team Task Manager assessment.

Deployed application: https://glacier-team-task-manager.web.app
API (for verification): https://standings-exit-trainer-terminal.trycloudflare.com/api
GitHub repository: https://github.com/SrRecode/team-task-manager

The repository includes the frontend, backend, setup instructions, and Git workflow history.

Thank you for the opportunity.
```

Only state that the assessment is completed once the required functionality and live deployment have been verified.
