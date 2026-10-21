# Environment Variables

## 1. Principles

- Commit `.env.example` files containing placeholders only.
- Keep real `.env` files out of Git.
- Never expose server secrets to Vite/browser variables.
- Configure production values through deployment settings or a secret manager.
- Validate required variables at server startup and fail with a safe, actionable message.

## 2. Backend example

Create `server/.env.example`:

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/glacier_tasks
SESSION_SECRET=replace-with-a-long-random-development-secret
CLIENT_ORIGIN=http://localhost:5173
```

The connection format is an example. Adjust it if using discrete PG variables or a Cloud SQL connector.

## 3. Frontend example

Create `client/.env.example`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Only non-secret browser configuration belongs in `VITE_` variables.

## 4. Production configuration

Configure:
- Production database connection.
- Long random session secret.
- Exact frontend origin.
- `NODE_ENV=production`.
- Cloud SQL connectivity options if used.
- Any CSRF configuration required by the implementation.

Do not copy local database passwords into documentation or commit real production values.

## 5. Git ignore

At minimum ignore:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
coverage/
*.log
.DS_Store
```

Review existing ignore rules before replacing them. Never commit credentials, private keys, database dumps containing personal data, or session cookies.
