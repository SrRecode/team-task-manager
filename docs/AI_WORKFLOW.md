# AI-Assisted Development Workflow

## Goal

Use an AI coding extension to accelerate implementation while preserving correctness, code readability, security and ownership of the work.

## 1. Start with an audit

Ask the coding agent to:
- Inspect the repository and current Git status.
- Read this documentation and the assessment traceability matrix.
- Identify working, partial, missing and broken requirements.
- Run available tests/builds without destructive changes.
- Return a prioritized gap report with file references.

Do not ask it to rewrite the entire app before the audit.

## 2. Implement one milestone at a time

Recommended order:
1. Project startup and database migrations.
2. Authentication and sessions.
3. Team management and membership.
4. Task CRUD, assignment and filters.
5. Frontend integration.
6. Security and tests.
7. GCP deployment.
8. Final documentation and submission.

For each milestone, ask the agent to list planned files, implement a small slice, run tests, and report results.

## 3. Agent instructions

- Read existing code before editing.
- Reuse working implementations.
- Do not overwrite unrelated files.
- Do not invent successful test results.
- Do not disable tests or weaken security to make a build pass.
- Do not commit secrets.
- Do not automatically commit, push, merge or deploy without explicit approval.
- Explain migrations and destructive changes before applying them.
- Use parameterized SQL and server-side authorization.
- Update docs when behavior or configuration changes.

## 4. Review every change

Before accepting AI-generated code:
- Inspect `git diff`.
- Check changed files and package dependencies.
- Run tests and build commands.
- Review authorization and validation logic.
- Confirm no `.env` files or credentials were added.
- Manually test the user flow.
- Commit only coherent, verified changes.

## 5. Prompt template

```text
You are the senior engineer on this existing repository.

First inspect the code, package manifests, Git status, and relevant docs.
Do not overwrite or recreate working code.

Current milestone: [describe one milestone]
Acceptance criteria:
- [criterion 1]
- [criterion 2]
- [criterion 3]

Before editing, report:
1. Current state
2. Missing requirements
3. Files to change
4. Risks and test plan

Then implement only this milestone. Run relevant tests/build commands.
Do not claim success for anything not verified. Do not commit, push,
merge, deploy, or change branches without my explicit approval.

Finish with:
- Files changed
- Behavior implemented
- Commands and actual results
- Manual verification steps
- Remaining limitations
- Recommended next milestone
```

## 6. Context management

Keep stable requirements in these Markdown files rather than relying on a long chat history. At the end of each session, update a short status section in `PROJECT_PLAN.md` with completed items, test results, current branch, blockers and next action. Avoid pasting secrets or large irrelevant logs into AI prompts.
