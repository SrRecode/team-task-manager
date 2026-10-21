# Submission Message (REQ-27)

REQ-27 asks for two links, sent through Indeed:

| Link | Value | State |
|---|---|---|
| GitHub repository | `https://github.com/SrRecode/team-task-manager` | **verified** — the `origin` remote of this checkout |
| Deployed application | `REPLACE_WITH_VERIFIED_DEPLOYED_URL` | **pending** — the site only exists after the GCP deployment |

The deployed URL is the only missing value, and it cannot be filled in from the
repository: it exists only after the Cloud Run and Firebase Hosting steps of
[the deployment runbook](DEPLOYMENT_RUNBOOK.md) have been executed.

## 1. Fill in the deployed URL

After step 9 and step 10 of the runbook:

```powershell
gcloud run services describe glacier-api --region REGION --format="value(status.url)"
```

The frontend URL is `https://PROJECT_ID.web.app` and the API URL is the output
of the command above. Replace every occurrence of
`REPLACE_WITH_VERIFIED_DEPLOYED_URL` in this file, in
`docs/SUBMISSION_CHECKLIST.md` and in `README.md` with the frontend URL.

Keep the API URL in the README as well, so the evaluator can check that the
backend is live.

## 2. Verify before sending

Do not send the message before every line below is true. Each one is a
requirement from `docs/TESTING.md` § 4 and `docs/SUBMISSION_CHECKLIST.md`.

- [ ] The frontend URL opens in a **private window** that has never visited the
      site, and shows the sign-in screen.
- [ ] A new account can register, sign out and sign in again.
- [ ] The session cookie exists in the developer tools with `HttpOnly`,
      `Secure` and `SameSite=None`.
- [ ] A team can be created, a member added, a task created and assigned.
- [ ] The filters by team, assignee, status and search term work.
- [ ] A request to a protected route without the cookie answers `401`.
- [ ] The browser console shows no error, and the API log shows no `5xx`.
- [ ] The repository URL opens and the README setup steps work on a clean
      checkout (`npm ci` in `client` and `server`, `npm run migrate`, `npm run dev`).

## 3. The message to send

```text
Hello,

I have completed the Team Task Manager assessment.

Deployed application: REPLACE_WITH_VERIFIED_DEPLOYED_URL
API (for verification): REPLACE_WITH_VERIFIED_API_URL
GitHub repository: https://github.com/SrRecode/team-task-manager

The repository contains the React + Tailwind + Vite frontend, the Node.js +
Express REST API, the PostgreSQL schema and migrations, the automated test
suite and the GitHub pull-request history.

Setup instructions are in the README, the deployment steps are in
docs/DEPLOYMENT_RUNBOOK.md, and the test plan is in docs/TESTING.md.

Thank you for the opportunity.
```

## 4. Why the two links are enough

- The **repository** link is the deliverable of REQ-24 and REQ-25: the code,
  the setup instructions and the branch/PR history. It is already public and
  reachable at the address above.
- The **deployed** link is the deliverable of REQ-26: a public frontend on
  Firebase Hosting, an API on Cloud Run and a PostgreSQL database on Cloud SQL,
  reachable over HTTPS with a working session cookie.

Both are linked from the README, so the evaluator can navigate from the
repository to the running application and back.
