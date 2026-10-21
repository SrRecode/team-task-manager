# Git and GitHub Workflow

The assessment explicitly requires Git and GitHub with branching or pull-request history. Preserve genuine history; do not fabricate commits or PRs.

## 1. Branch strategy

- `main`: stable, reviewed work.
- `feat/auth`: registration, login and sessions.
- `feat/teams`: team and membership features.
- `feat/tasks`: task CRUD and filtering.
- `feat/frontend`: UI integration and responsive states.
- `fix/security-*`: focused security fixes.
- `docs/*`: documentation-only changes when useful.

Branch names are suggestions; use the existing repository's conventions if already established.

## 2. First-time setup

```powershell
git status
git branch --show-current
git remote -v
```

If the repository is not initialized:

```powershell
git init -b main
git add .
git commit -m "chore: initialize project structure"
```

Create a GitHub repository, add its URL as `origin`, and push:

```powershell
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

Replace the placeholder with the real URL. Do not paste credentials into remote URLs.

## 3. Feature workflow

```powershell
git switch main
git pull origin main
git switch -c feat/auth

# Make a small coherent change and run tests
git status
git diff
git add <specific-files>
git commit -m "feat: implement session authentication"
git push -u origin feat/auth
```

Open a GitHub pull request from `feat/auth` into `main`. Review changed files, tests and security-sensitive code. Merge only after checks pass. Then update local `main`:

```powershell
git switch main
git pull origin main
git switch -c feat/teams
```

Repeat for each meaningful feature.

## 4. Commit message examples

- `chore: initialize frontend and backend workspaces`
- `feat: add PostgreSQL schema migrations`
- `feat: implement Passport session authentication`
- `feat: add team membership management`
- `feat: implement task CRUD and filters`
- `test: cover cross-team task authorization`
- `docs: document local setup and deployment`
- `fix: reject assignees outside the selected team`

## 5. If the project already has one large commit

Do not reset or delete working code just to create artificial history.

1. Check `git status` and back up important uncommitted work.
2. Create a new branch from the current state.
3. Audit existing features.
4. Implement missing features in genuine feature branches.
5. Open real pull requests for those changes.
6. Keep existing history honest.

A branch created today does not prove older work was developed on that branch. The purpose is to demonstrate a real, understandable workflow going forward.

## 6. Pull request checklist

- [ ] Title describes the feature.
- [ ] Scope is focused.
- [ ] No `.env`, credentials, database dumps or generated secrets.
- [ ] Tests/build run or limitations are stated.
- [ ] Database migrations are included if needed.
- [ ] README/docs are updated where behavior changed.
- [ ] Authorization and error paths were reviewed.
- [ ] No unrelated formatting churn.
- [ ] Merge only after review.

## 7. Final evidence

Confirm the repository visibly shows:
- Feature branches or branch references.
- Multiple meaningful commits.
- Real pull requests and merge history, if using PRs.
- Working frontend and backend code.
- Setup and deployment documentation.
