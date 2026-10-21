# Final Assessment Submission Checklist

The assessment requests a GitHub repository containing working frontend/backend code and setup instructions, a deployed version on GCP, and submission of the deployed link and repository link through Indeed.

## 1. Repository
- [ ] Repository is accessible to the evaluator.
- [ ] Frontend and backend source are included.
- [ ] No credentials or `.env` files are committed.
- [ ] README provides accurate local setup instructions.
- [ ] Environment variables are documented.
- [ ] Database migration instructions are included.
- [ ] GitHub branch or pull-request history is visible.
- [ ] Code is readable and logically organized.

## 2. Required functionality
- [ ] Register and log in securely.
- [ ] Create and manage teams.
- [ ] Add team members.
- [ ] Create, assign, update and delete tasks.
- [ ] Filter tasks by team and assigned member.
- [ ] Dashboard displays team and task lists.
- [ ] Task create/update modal works.
- [ ] UI is responsive.
- [ ] Validation and server-side authorization work.
- [ ] Passwords are bcrypt-hashed.
- [ ] Sessions are stored in PostgreSQL in deployment.
- [ ] Non-auth routes are protected.

## 3. Deployment
- [ ] Public frontend URL works.
- [ ] API URL works.
- [ ] Production database is reachable by the API.
- [ ] HTTPS and session cookies work.
- [ ] CORS and CSRF protections work in the deployed topology.
- [ ] Fresh account can complete the full flow.
- [ ] No critical browser or server errors.
- [ ] GCP billing/pricing has been checked.

## 4. Final links

Fill these in with verified values before submitting:

- **Deployed application:** `REPLACE_WITH_VERIFIED_DEPLOYED_URL`
- **GitHub repository:** `REPLACE_WITH_VERIFIED_REPOSITORY_URL`

Do not submit placeholders.

## 5. Submission message

```text
Hello,

I have completed the Team Task Manager assessment.

Deployed application: [insert verified deployed URL]
GitHub repository: [insert repository URL]

The repository includes the frontend, backend, setup instructions, and Git workflow history.

Thank you for the opportunity.
```

Only state that the assessment is completed once the required functionality and live deployment have been verified.
