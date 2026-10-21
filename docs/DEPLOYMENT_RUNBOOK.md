# Deployment Runbook

This runbook deploys the Team Task Manager to Google Cloud with the topology of
`docs/DEPLOYMENT_GCP.md`:

```text
Browser → https://PROJECT_ID.web.app        (Firebase Hosting, the client)
        → https://glacier-api-…run.app      (Cloud Run, the Express API)
        → 127.0.0.1:5432                    (Cloud SQL Auth Proxy sidecar)
        → Cloud SQL for PostgreSQL           (private, no public IP)
```

Every command is written for PowerShell on Windows. The `gcloud` commands are
identical on macOS and Linux; on a POSIX shell use `export VAR=value` instead
of `$env:VAR=value`.

**Cost warning:** Cloud SQL, Cloud Run and Artifact Registry are billable. Check
the pricing and the billing account of the project before you create the
resources, and delete the Cloud SQL instance when the assessment is over.

---

## 0. The one command that does everything

`deploy/deploy.ps1` performs the whole deployment: it checks the environment,
enables the APIs, creates the Artifact Registry repository, the service
account, the Cloud SQL instance, the database, the user and the secrets, applies
the migrations through the Cloud SQL Auth Proxy, deploys the API to Cloud Run
and deploys the client to Firebase Hosting.

```powershell
# check the environment first, nothing is created
.\deploy\deploy.ps1 -Check

# the deployment itself
.\deploy\deploy.ps1 -ProjectId PROJECT_ID -Region REGION
```

The script is idempotent, so it can be run again after a partial failure. The
rest of this runbook explains every step, in case the script has to be done by
hand.

### The one thing the script cannot do

A project without a billing account cannot run Cloud Run, Cloud SQL or Artifact
Registry. Google rejects the activation of those APIs with
`FAILED_PRECONDITION: Billing account for project ... is not found`. Link a
billing account first:

<https://console.cloud.google.com/billing/linkedaccount?project=PROJECT_ID>

Without a billing account the script stops with that instruction, before it
creates anything.

### Organization policies

An organization can restrict which services a project may use
(`constraints/gcp.restrictServiceUsage`). The script adapts to it:

| Service | Used for | When it is blocked |
|---|---|---|
| `run.googleapis.com` | the API | nothing else can host the API |
| `sqladmin.googleapis.com` | the database | no database on GCP |
| `artifactregistry.googleapis.com` | the image | the image has to come from somewhere else |
| `cloudbuild.googleapis.com` | building the image | the image is built locally with Docker instead |
| `secretmanager.googleapis.com` | the secrets | the secrets are set as environment variables of the service |
| `servicenetworking.googleapis.com` | the private IP of Cloud SQL | the instance gets a public IP and stays behind the Auth Proxy |
| `firebasehosting.googleapis.com` | the client | the client is served by another host |

---

## 0.0 What this project found in the assessment environment

The deployment was attempted on 21 October 2026 with the account that owns the
assessment. The findings are written down here, because they decide which
project the deployment can use.

| Check | Result |
|---|---|
| Account | `sr192153@gmail.com` |
| Project with a billing account | `electric-balm-3xjsq` (free tier roles of the organisation) |
| Project owned by the account | `glacier-team-task-manager` (owner role, **no billing account**) |
| `gcloud`, `docker`, `firebase-tools` | installed and working |
| Local PostgreSQL 18, Node.js 24 | installed and working |

### The two blockers

**1. `electric-balm-3xjsq` cannot run the workload.**

| Attempt | Error |
|---|---|
| `gcloud run deploy glacier-api` | `Permission 'run.services.create' denied on resource 'namespaces/electric-balm-3xjsq/services/glacier-api'` |
| `gcloud sql instances create glacier-db --tier=db-f1-micro` | `Operation denied by org policy: customConstraints/custom.disallowCloudSqlNonDbDevSmallTiers — Cloud SQL instance tier must be db-dev-small` |
| `gcloud sql instances create glacier-db --tier=db-dev-small` | `Invalid Tier (db-dev-small) for (ENTERPRISE) Edition` (the tier no longer exists in the Cloud SQL API) |
| `gcloud services enable cloudbuild artifactregistry secretmanager` | `Permission denied to enable service` (`serviceusage.services.enable` is not granted) |

The account only holds the three organisation roles `runSaasUserFreeTier`,
`cloudSqlUserFreeTier` and `firebaseUserFreeTier` of the organisation
`71994629047`. They do not contain `run.services.create`, and the
`setIamPolicy` permission is not granted either, so the account cannot grant
them to itself.

**2. `glacier-team-task-manager` has no billing account.**

| Attempt | Error |
|---|---|
| `gcloud services enable run.googleapis.com` | `Billing must be enabled for activation of service(s) ...` |
| `gcloud sql instances create glacier-db` | `the billing account is not in good standing; therefore no new instance can be created` |
| `gcloud billing projects link glacier-team-task-manager --billing-account=01975A-AA50D4-147228` | `Permission 'billing.resourceAssociations.create' denied` |

Firebase Hosting is the exception: it works without a billing account, so the
frontend of the project is live on
<https://glacier-team-task-manager.web.app>.

### The one action that unblocks the whole deployment

Link a billing account to `glacier-team-task-manager`. Everything else is
already in place: the account is the owner of the project, so it may enable
the APIs, create the Artifact Registry repository, the Cloud SQL instance and
the Cloud Run service.

<https://console.cloud.google.com/billing/linkedaccount?project=glacier-team-task-manager>

After that, one command deploys the API, the database and the client:

```powershell
.\deploy\deploy.ps1 -ProjectId glacier-team-task-manager -Region asia-south1
```

---

## 0.1 Prerequisites

| Requirement | How to get it |
|---|---|
| A Google Cloud project with billing enabled | <https://console.cloud.google.com/projectcreate> |
| The `gcloud` CLI | `winget install --id Google.CloudSDK --source winget`, or the installer from <https://cloud.google.com/sdk/docs/install> |
| The Firebase CLI | `npm install -g firebase-tools` |
| Docker, for the local image build | <https://docs.docker.com/desktop/install/windows-install/> |
| A Cloud SQL user with the `postgres` role | granted below |

> The `gh` and `firebase` commands on this machine are npm packages, not the
> official tools. `firebase-tools` has to be reinstalled globally.

```powershell
gcloud --version
gcloud init                      # sign in and pick the project
gcloud config set project PROJECT_ID
gcloud config set compute/region REGION      # for example asia-south1
```

---

## 1. Enable the required APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudsqladmin.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  cloudbuild.googleapis.com `
  servicenetworking.googleapis.com `
  firebase.googleapis.com
```

## 2. Reserve the private network range for Cloud SQL

Cloud SQL with a private IP needs an allocated range in the VPC.

```powershell
gcloud compute networks vpc-access connect --name=default --region=REGION
```

## 3. Create the Artifact Registry repository

```powershell
gcloud artifacts repositories create glacier `
  --repository-format=docker --location=REGION --description="API images"
```

## 4. Create the Cloud SQL instance, the database and the application user

```powershell
gcloud sql instances create glacier-db `
  --database-version=POSTGRES_16 --cpu=1 --memory=2GiB --region=REGION `
  --availability-type=REGIONAL --edition=ENTERPRISE --no-assign-ip
```

The instance has no public IP. It is only reachable through the Auth Proxy.

> If the command is refused with `Invalid Tier (db-custom-1-2048) for
> (ENTERPRISE_PLUS) Edition`, the project does not allow that machine type.
> Create the instance with the free tier shape instead:
>
> ```powershell
> gcloud sql instances create glacier-db `
>   --database-version=POSTGRES_16 --tier=db-f1-micro --region=REGION `
>   --availability-type=REGIONAL --edition=ENTERPRISE --no-assign-ip
> ```
>
> `--no-assign-ip` needs the VPC peering of step 2. When
> `servicenetworking.googleapis.com` is blocked, use `--assign-ip` and keep the
> instance behind the Auth Proxy, which encrypts the connection.

```powershell
gcloud sql databases create glacier_tasks --instance=glacier-db

# A password made of hex characters only, so that it needs no URL encoding.
$DbPassword = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
gcloud sql users create glacier_app --instance=glacier-db --password=$DbPassword
```

Keep `$DbPassword` in the shell: it is needed for the secret and for the
migration step.

## 5. Create the service account of the API

```powershell
gcloud iam service-accounts create glacier-run --display-name="Glacier API on Cloud Run"

gcloud projects add-iam-policy-binding PROJECT_ID `
  --member="serviceAccount:glacier-run@PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding PROJECT_ID `
  --member="serviceAccount:glacier-run@PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

## 6. Store the secrets in Secret Manager

```powershell
$SessionSecret = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

gcloud secrets create glacier-api-secrets --replication-policy=automatic

"session-secret=$SessionSecret" | gcloud secrets versions add glacier-api-secrets --data-file=-
"database-url=postgresql://glacier_app:$DbPassword@127.0.0.1:5432/glacier_tasks" | gcloud secrets versions add glacier-api-secrets --data-file=-
```

The database URL points at `127.0.0.1:5432`, because the Cloud SQL Auth Proxy
sidecar listens there inside the Cloud Run container.

## 7. Apply the migrations

The migration is a deliberate release step, never an HTTP request. Run it from
your machine through the Cloud SQL Auth Proxy:

1. Download the proxy for Windows and start it:

   ```powershell
   $ProxyUrl = "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.26.2/cloud-sql-proxy.x64.exe"
   Invoke-WebRequest -Uri $ProxyUrl -OutFile .\cloud-sql-proxy.exe
   .\cloud-sql-proxy.exe --port 5432 PROJECT_ID:REGION:glacier-db
   ```

2. In a second terminal, run the migration:

   ```powershell
   $env:DATABASE_URL = "postgresql://glacier_app:$DbPassword@127.0.0.1:5432/glacier_tasks"
   cd server
   npm run migrate
   ```

The output has to list `001_init.sql` as applied. The migration also creates the
`session` table that the PostgreSQL session store uses.

## 8. Build and push the API image

With Cloud Build:

```powershell
gcloud builds submit `
  --tag REGION-docker.pkg.dev/PROJECT_ID/glacier/api:latest `
  server
```

Cloud Build reads `server/Dockerfile` and `server/.dockerignore`.

Without Cloud Build, build the image locally and push it to the same
repository. The result is the same image, only the build runs on the machine
instead of in the cloud:

```powershell
gcloud auth configure-docker REGION-docker.pkg.dev --project PROJECT_ID
cd server
docker build -t REGION-docker.pkg.dev/PROJECT_ID/glacier/api:latest .
docker push REGION-docker.pkg.dev/PROJECT_ID/glacier/api:latest
```

The image runs as the unprivileged `node` user, listens on port 8080 and
answers `GET /health`.

## 9. Deploy the API to Cloud Run

Replace the placeholders in `deploy/cloud-run-api.yaml` (`PROJECT_ID`, `REGION`,
`INSTANCE_ID`) and apply it:

```powershell
gcloud run services replace deploy/cloud-run-api.yaml --region REGION --project PROJECT_ID
```

Read the public URL:

```powershell
gcloud run services describe glacier-api --region REGION --format="value(status.url)"
```

Verify the service:

```powershell
$ApiUrl = "https://glacier-api-xxxx-uc.a.run.app"
curl "$ApiUrl/health"
curl "$ApiUrl/health?database=true"      # {"status":"ok","database":"up"}
```

## 10. Deploy the client to Firebase Hosting

```powershell
npm install -g firebase-tools
firebase login
firebase use --add                        # choose PROJECT_ID
```

Build the client with the URL of the live API. `VITE_API_URL` is baked into the
browser bundle, so it has to be set **before** the build:

```powershell
cd client
$env:VITE_API_URL = "https://glacier-api-xxxx-uc.a.run.app/api"
npm run build
firebase deploy --only hosting
```

The site is served from `https://PROJECT_ID.web.app`. `client/firebase.json`
rewrites every path to `index.html`, so the client-side routes work on a
refresh.

## 11. The live smoke test

Open `https://PROJECT_ID.web.app` in a private window and run through
`docs/TESTING.md` § 4:

1. Register a user, sign out, sign in again.
2. Create a team, add a second registered user.
3. Create a task, assign it to the member, change its status.
4. Filter by team, assignee, status and search term.
5. Sign out and confirm that the protected routes answer with 401.

Check the cookie in the browser developer tools (Application → Cookies):

| Flag | Expected value | Why |
|---|---|---|
| `HttpOnly` | on | the JavaScript of the page must not read the session |
| `Secure` | on | the API is only reachable over HTTPS |
| `SameSite` | `None` | the frontend and the API are different sites |
| `Path` | `/` | the cookie is sent to every API route |

`SameSite=None` is only accepted by a browser together with `Secure`. If the
cookie is missing in the developer tools, check the `Set-Cookie` header of the
login response first.

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 CORS_DENIED` | the origin of the client is not in `CLIENT_ORIGIN` | set `CLIENT_ORIGIN` to the exact frontend origin, including the scheme |
| `403 Request origin is not allowed` | the CSRF origin check rejected the request | the `Origin` header has to be in `allowedOrigins`; the same value as `CLIENT_ORIGIN` |
| The session cookie is not stored | `SameSite=None` without `Secure`, or the request was not over HTTPS | check `SESSION_SAME_SITE=none` and `NODE_ENV=production` |
| `503 {"database":"down"}` | the API cannot reach Cloud SQL | check the sidecar logs, the service account role and the instance connection name |
| The migrations fail to connect | the Cloud SQL instance has no public IP and no proxy is running | start the Cloud SQL Auth Proxy locally |
| The client calls the wrong API | `VITE_API_URL` was not set before the build | rebuild with the variable set |

## 13. After the assessment

- Delete the Cloud SQL instance: `gcloud sql instances delete glacier-db`.
- Delete the secrets and the Artifact Registry repository.
- Delete the Firebase Hosting site.
- Remove the deployed URL from the README, or keep it if the site is still up.
