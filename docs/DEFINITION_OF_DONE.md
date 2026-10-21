# Definition of Done

A feature is done only when it is implemented, tested, reviewed and documented to the level appropriate for the assessment.

## Feature-level definition of done

- [ ] Acceptance criteria are met.
- [ ] Validation exists on the server.
- [ ] Authentication and authorization are enforced where relevant.
- [ ] SQL uses parameters.
- [ ] Expected errors return appropriate status codes.
- [ ] Sensitive fields are not returned or logged.
- [ ] Loading, empty and error states exist in the UI where relevant.
- [ ] Relevant tests pass.
- [ ] Manual happy-path and negative-path checks pass.
- [ ] Code is understandable and avoids needless abstraction.
- [ ] Documentation is updated.
- [ ] `git diff` reviewed and changes committed on a feature branch.
- [ ] Pull request reviewed and merged honestly where the PR workflow is used.

## Release-level definition of done

- [ ] All mandatory assessment requirements are traceable and implemented.
- [ ] Fresh local setup works from documented instructions.
- [ ] Database migrations apply cleanly.
- [ ] Frontend production build succeeds.
- [ ] Backend starts using production configuration.
- [ ] Session store is PostgreSQL-backed in deployment.
- [ ] Authorization negative tests pass.
- [ ] No secrets are tracked by Git.
- [ ] GitHub branching or PR history is visible.
- [ ] Frontend, API and database are deployed on/through GCP as intended.
- [ ] Live end-to-end smoke test succeeds.
- [ ] README has accurate setup and deployment instructions.
- [ ] Deployed URL and repository URL are ready for submission.
