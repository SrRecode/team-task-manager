# Deployment Runbook

This runbook deploys the Team Task Manager to Google Cloud with the topology of
`docs/DEPLOYMENT_GCP.md`:

```text
Browser → https://PROJECT_ID.web.app        (Firebase Hosting, the client)
        → https://glacier-api-…run.app      (Cloud Run, the Express API)
        → 127.0.0.1:5432                    (Cloud SQL Auth Proxy sidecar)
        → Cloud SQL for PostgreSQL           (private, no public IP)
```

That topology needs a billing account. The deployment that is **live today**
uses the same client, the same API and the same PostgreSQL schema, but the API
runs in the local stack of the developer machine and is published through a
Cloudflare quick tunnel — see § 0.0.

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

The error above was reproduced on 21 October 2026 with a probe deployment
(`gcloud run deploy glacier-api-probe --image=gcr.io/cloudrun/hello`), so it is
not a side effect of the image.

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
already in place: the account is the owner of the project, so it may enable the
APIs, create the Artifact Registry repository, the Cloud SQL instance and the
Cloud Run service.

<https://console.cloud.google.com/billing/linkedaccount?project=glacier-team-task-manager>

After that, one command deploys the API, the database and the client:

```powershell
.\deploy\deploy.ps1 -ProjectId glacier-team-task-manager -Region asia-south1
```

### The blocker that is not about the permissions: Hosting is not a proxy

Firebase Hosting **cannot** forward a request to an arbitrary external URL.
The `destination` of a rewrite "must be a file that you deployed to Firebase
Hosting"; the only supported backends are a Cloud Function and a Cloud Run
container of the same project
(<https://firebase.google.com/docs/hosting/full-config#rewrites>).

That was measured on the live site on 21 October 2026. The rewrite
`/api/** → https://<host>/api/**` was deployed, and the Hosting edge answered
every `/api/**` request with its own 404 page (21 376 bytes,
`Cache-Control: max-age=3600`) instead of contacting the destination:

| Destination of the rewrite | Result |
|---|---|
| `https://<quick-tunnel>.trycloudflare.com/api/**` | Hosting 404, the tunnel logged no request |
| `https://example.com/**` | Hosting 404 |
| `https://httpbin.org/anything/**` | Hosting 404 |

The deployed version of the site confirms that the rewrite was stored
(`GET https://firebasehosting.googleapis.com/v1beta1/projects/glacier-team-task-manager/sites/glacier-team-task-manager/versions`
lists the rewrite in `config.rewrites`), so the rule is present and is not
applied. The same-origin topology of the diagram above is only possible with
the Cloud Run rewrite of Hosting, which needs the billing account of blocker 1
and 2.

**Consequence for the deployment that is live today:** the client calls the API
cross-origin, on the address of the API. The session cookie is therefore
`SameSite=None; Secure; HttpOnly`, and the API allows the origin of the
frontend in `CLIENT_ORIGIN`.

### The deployment that is live today

Verified on 21 October 2026. The client is on Firebase Hosting, the API and the
database run in the local stack of the developer machine, and the API is
published through a Cloudflare quick tunnel.

```text
Browser → https://glacier-team-task-manager.web.app   (Firebase Hosting)
        → https://<tunnel>.trycloudflare.com/api        (Cloudflare quick tunnel)
        → http://127.0.0.1:5000                         (Express API, local)
        → postgresql://…@localhost:5432/glacier_tasks   (PostgreSQL 18, local)
```

| Part | Where it runs | Verified |
|---|---|---|
| Client | Firebase Hosting, project `glacier-team-task-manager` | <https://glacier-team-task-manager.web.app> |
| API | local `server/src/server.js`, `NODE_ENV=production` | <https://standings-exit-trainer-terminal.trycloudflare.com/api> |
| Database | local PostgreSQL 18, database `glacier_tasks` | `/health?database=true` answers `{"status":"ok","database":"up"}` |
| Sessions | PostgreSQL, table `session` | 25 rows after the live test |

The commands are in § 0.2. The limitation of this topology: the address of a
quick tunnel changes with every restart of `cloudflared`, so the client has to
be built and deployed again afterwards. The public URL of the application
stays the same, but the API address in the browser bundle changes.

### 0.2 How the live deployment was made

```powershell
# 1. The API in the local stack, in production mode
cd server
$env:NODE_ENV = 'production'
$env:PORT = '5000'
$env:SESSION_SAME_SITE = 'none'          # the client is on another origin
$env:CLIENT_ORIGIN = 'https://glacier-team-task-manager.web.app'
$env:DATABASE_SSL = 'false'              # local PostgreSQL, no TLS
node src/server.js

# 2. The API in the public internet, in a second terminal
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:5000
# the line "Your quick Tunnel has been created!" holds the public address

# 3. The client, built with the address of the API and deployed with ADC
cd client
$env:VITE_API_URL = 'https://<tunnel>.trycloudflare.com/api'
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
npm run build
firebase deploy --only hosting --project glacier-team-task-manager --non-interactive
```

`cloudflared` is not installed on Windows by default; the binary was downloaded
from <https://github.com/cloudflare/cloudflared/releases>. The Firebase CLI
reads the Application Default Credentials of `gcloud` on its own, so
`firebase login` is not needed:

```powershell
gcloud auth application-default login     # writes application_default_credentials.json
gcloud auth application-default print-access-token   # proves that it works
```

The file is an `authorized_user` credential, which `firebase-tools` picks up
through `google-auth-library`. The deployment of the client was done with the
ADC only, no browser session.

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
gcloud auth application-default login        # the credentials the CLI reads
gcloud auth application-default print-access-token
```

The Firebase CLI reads the Application Default Credentials of `gcloud`, so
`firebase login` is not needed and no browser session is opened. To make it
explicit, the path of the credential file can be set:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
```

Build the client with the URL of the live API. `VITE_API_URL` is baked into the
browser bundle, so it has to be set **before** the build:

```powershell
cd client
$env:VITE_API_URL = "https://glacier-api-xxxx-uc.a.run.app/api"
npm run build
firebase deploy --only hosting --project PROJECT_ID --non-interactive
```

The site is served from `https://PROJECT_ID.web.app`. `client/firebase.json`
rewrites every path to `index.html`, so the client-side routes work on a
refresh.

**The API is called on its own address, not on `/api` of the site.** Firebase
Hosting does not proxy to an arbitrary external URL (§ 0.0), so the rewrite to
an external backend is not an option. The client therefore uses the address of
the API, and the API has to allow the origin of the frontend:

| Setting | Value |
|---|---|
| `VITE_API_URL` | the public address of the API, with the `/api` prefix |
| `CLIENT_ORIGIN` | the exact origin of the frontend, e.g. `https://PROJECT_ID.web.app` |
| `SESSION_SAME_SITE` | `none`, because the two origins are different sites |
| `NODE_ENV` | `production`, so the cookie is `Secure` |

The alternative is the Cloud Run rewrite of Hosting, which keeps the API on the
same origin and the cookie a first-party cookie. It needs a Cloud Run service
in the project, and that needs the billing account of § 0.0.

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

### The result of 21 October 2026

The whole list was run against the live deployment, once with an API script
and once in a real browser (Chrome, headless). The steps and the raw results
are in `docs/TESTING.md` § "The live run of 21 October 2026".

| Step | Result |
|---|---|
| The frontend opens | 200, the sign-in screen |
| Register | 201, the session cookie is set |
| The cookie flags | `HttpOnly`, `Secure`, `SameSite=None`, `Path=/` |
| Sign out | 204, the protected routes answer with 401 afterwards |
| Sign in | 200, the session is restored |
| Create a team, add a member | 201 and 201, the team has 2 members |
| Create a task, assign it | 201, the task shows the assignee |
| Filter by team, assignee, status, search | 1, 1, 0 for another status, 1 and 0 for a term that does not match |
| Update the task | 200, the new status is shown |
| Sign out | 204, `/teams` redirects to the sign-in screen |
| The database | `/health?database=true` answers `{"status":"ok","database":"up"}` |
| The sessions | 25 rows in the `session` table of PostgreSQL |

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 CORS_DENIED` | the origin of the client is not in `CLIENT_ORIGIN` | set `CLIENT_ORIGIN` to the exact frontend origin, including the scheme |
| `403 Request origin is not allowed` | the CSRF origin check rejected the request | the `Origin` header has to be in `allowedOrigins`; the same value as `CLIENT_ORIGIN` |
| The session cookie is not stored | `SameSite=None` without `Secure`, or the request was not over HTTPS | check `SESSION_SAME_SITE=none` and `NODE_ENV=production` |
| `503 {"database":"down"}` | the API cannot reach Cloud SQL | check the sidecar logs, the service account role and the instance connection name |
| The migrations fail to connect | the Cloud SQL instance has no public IP and no proxy is running | start the Cloud SQL Auth Proxy locally |
| The client calls the wrong API | `VITE_API_URL` was not set before the build | rebuild with the variable set |
| Every `/api/**` request answers with the 404 page of Hosting | a rewrite to an external URL is not applied, Hosting is not a proxy | call the API on its own address, see § 0.0 and § 10 |
| The API answers with `530 Error 1033` | the quick tunnel is not running | start `cloudflared` again, then rebuild and redeploy the client with the new address |
| The browser shows the sign-in screen although the sign-in was successful | the browser refused the third-party cookie | allow third-party cookies for the site, or deploy the API on the same origin |

## 13. After the assessment

- Delete the Cloud SQL instance: `gcloud sql instances delete glacier-db`.
- Delete the secrets and the Artifact Registry repository.
- Delete the Firebase Hosting site.
- Stop the quick tunnel and the local API, and remove the tunnel address from
  the README, or keep it if the stack is still running.
- Remove the deployed URL from the README, or keep it if the site is still up.

## 14. What the deployment costs

The footprint of the deployment is deliberately small, so it stays inside the
free trial credit of a new project and costs almost nothing after that.

| Resource | Setting | Cost |
|---|---|---|
| Cloud Run | `minScale: 0`, `maxScale: 3` | no cost while it is idle, the free tier covers the requests |
| Cloud SQL for PostgreSQL | `db-f1-micro`, `ZONAL`, 10 GB | the smallest instance Google Cloud offers, about 0.01 USD per hour |
| Artifact Registry | one image of about 50 MB | a few cents per month |
| Secret Manager | two secrets | free |
| Firebase Hosting | one static site | free (Spark plan) |

The script uses those settings by default (`-Tier db-f1-micro`,
`-AvailabilityType ZONAL`). A bigger instance is only needed for a load test.

Delete the Cloud SQL instance when the assessment is over, it is the only
resource that costs money every hour.

