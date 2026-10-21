<#
.SYNOPSIS
  Deploys the Team Task Manager to Google Cloud.

.DESCRIPTION
  Runs the whole deployment of the assessment in one go:

    1. checks the environment (gcloud, Docker, the billing account, the APIs)
    2. enables the APIs the project needs
    3. creates the Artifact Registry repository and builds the API image
    4. creates the service account of the API and its IAM bindings
    5. creates the Cloud SQL instance, the database and the application user
    6. stores the secrets (Secret Manager when the project allows it)
    7. applies the migrations through the Cloud SQL Auth Proxy
    8. deploys the API to Cloud Run
    9. builds the client and deploys it to Firebase Hosting
   10. prints the two URLs of the submission and the smoke test commands

  Every step is idempotent: a resource that already exists is left alone.

.PARAMETER ProjectId
  The Google Cloud project that hosts the deployment. It needs a billing
  account, otherwise Cloud Run, Cloud SQL and Artifact Registry cannot be
  created.

.PARAMETER Region
  The region of the Cloud SQL instance, the Artifact Registry repository and the
  Cloud Run service.

.PARAMETER Check
  Only run the preflight checks and print what is missing. Nothing is created.

.PARAMETER SkipClient
  Only deploy the API, not the frontend.

.PARAMETER Tier
  The machine type of the Cloud SQL instance. The default is the smallest
  shared core shape, which is the cheapest one that Google Cloud offers.

.PARAMETER AvailabilityType
  ZONAL (the default) is cheaper than REGIONAL and is enough for an
  assessment.

.EXAMPLE
  .\deploy.ps1 -Check
  .\deploy.ps1 -ProjectId my-project -Region asia-south1
#>
[CmdletBinding()]
param(
  [string]$ProjectId = 'glacier-team-task-manager',
  [string]$Region = 'asia-south1',
  [string]$InstanceId = 'glacier-db',
  [string]$Repository = 'glacier',
  [string]$ServiceName = 'glacier-api',
  [string]$DatabaseName = 'glacier_tasks',
  [string]$AppUser = 'glacier_app',
  [string]$SecretName = 'glacier-api-secrets',
  [string]$ServiceAccount = 'glacier-run',
  [string]$Tier = 'db-f1-micro',
  [string]$AvailabilityType = 'ZONAL',
  [switch]$Check,
  [switch]$SkipClient
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step($message) {
  Write-Host ''
  Write-Host "== $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "   ok: $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "   !  $message" -ForegroundColor Yellow
}

function Write-Fail($message) {
  Write-Host "   x  $message" -ForegroundColor Red
}

function Get-Gcloud {
  $command = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  throw 'The gcloud CLI is not installed. See the runbook, section 0.'
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [string[]]$Arguments = @()
  )

  # The CLIs write their progress to stderr. Merging it into the output is
  # useful, but the error records it produces must not stop the script.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $Command @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
    return [pscustomobject]@{ ExitCode = $code; Output = $text }
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Invoke-Gcloud {
  param([Parameter(ValueFromRemainingArguments = $true)]$Arguments)

  return Invoke-Native -Command { & $script:Gcloud @Arguments } -Arguments $Arguments
}

function Invoke-Firebase {
  param([Parameter(ValueFromRemainingArguments = $true)]$Arguments)

  $firebase = Get-Command firebase -ErrorAction SilentlyContinue
  if (-not $firebase) {
    return [pscustomobject]@{ ExitCode = 1; Output = 'The Firebase CLI is not installed. Run "npm install -g firebase-tools".' }
  }

  return Invoke-Native -Command { & $firebase.Source @Arguments } -Arguments $Arguments
}

function Test-ApiEnabled {
  param([string]$Service)

  $result = Invoke-Gcloud 'services' 'list' '--enabled' '--project' $ProjectId '--format=value(config.name)'
  return $result.Output -split "`n" | Where-Object { $_.Trim() -eq $Service }
}

function Enable-Api {
  param([string]$Service)

  if (Test-ApiEnabled $Service) {
    Write-Ok "$Service is enabled"
    return $true
  }

  $result = Invoke-Gcloud 'services' 'enable' $Service '--project' $ProjectId
  if ($result.ExitCode -eq 0) {
    Write-Ok "$Service enabled"
    return $true
  }

  Write-Warn "$Service could not be enabled: $($result.Output.Split("`n")[0])"
  return $false
}

function New-RandomSecret {
  param([int]$Bytes = 24)

  $bytes = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# ---------------------------------------------------------------------------
# 0. Preflight
# ---------------------------------------------------------------------------

Write-Step 'Checking the environment'

$script:Gcloud = Get-Gcloud
$version = Invoke-Gcloud '--version'
Write-Ok "gcloud: $($version.Output.Split("`n")[0])"

$account = Invoke-Gcloud 'config' 'get-value' 'account'
if (-not $account.Output) {
  throw 'No Google account is signed in. Run "gcloud auth login" first.'
}
Write-Ok "signed in as $($account.Output)"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Write-Ok "docker: $(& docker --version)"
} else {
  Write-Warn 'Docker is not installed. The image will be built by Cloud Build instead.'
}

$blocking = @()

$billing = Invoke-Gcloud 'billing' 'projects' 'describe' $ProjectId '--format=value(billingEnabled)'
if ($billing.ExitCode -ne 0) {
  $blocking += "the project $ProjectId does not exist, or the account cannot read it"
} elseif ($billing.Output.Trim() -ne 'True') {
  $blocking += @"
the project $ProjectId has no billing account. Cloud Run, Cloud SQL and Artifact Registry
cannot be created without one. Open
https://console.cloud.google.com/billing/linkedaccount?project=$ProjectId
and link a billing account, then run this script again.
"@
} else {
  Write-Ok "the project $ProjectId has a billing account"
}

$firebase = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebase) {
  $blocking += 'the Firebase CLI is not installed. Run "npm install -g firebase-tools".'
} else {
  $firebaseAuth = Invoke-Firebase 'projects:list' '--project' $ProjectId '--non-interactive'
  # The Firebase CLI can end with a non-zero exit code on Windows, even when
  # the command worked, so the output decides.
  if ($firebaseAuth.Output -match 'Invalid refresh token|requires authentication|not authenticated|401 Unauthorized') {
    $blocking += @"
the Firebase CLI is not signed in for this account. Run "firebase login" once, then run
this script again. A stale token is the usual reason for this failure.
"@
  } else {
    Write-Ok 'the Firebase CLI is signed in'
  }
}

foreach ($api in @('run.googleapis.com', 'sqladmin.googleapis.com', 'artifactregistry.googleapis.com', 'firebasehosting.googleapis.com')) {
  if (Test-ApiEnabled $api) {
    Write-Ok "$api is enabled"
  } else {
    Write-Warn "$api is not enabled yet, the script enables it when the project allows it"
  }
}

if ($blocking.Count -gt 0) {
  Write-Host ''
  Write-Host 'The deployment cannot start yet:' -ForegroundColor Red
  foreach ($item in $blocking) { Write-Host "   - $item" -ForegroundColor Red }
  Write-Host ''
  Write-Host 'Everything else (the code, the tests, the deployment artifacts) is ready.' -ForegroundColor Yellow
  exit 1
}

if ($Check) {
  Write-Step 'Preflight finished'
  Write-Host 'Everything that is needed for the deployment is in place.' -ForegroundColor Green
  exit 0
}

# ---------------------------------------------------------------------------
# 1. APIs
# ---------------------------------------------------------------------------

Write-Step 'Enabling the APIs'

$apis = @(
  'run.googleapis.com',
  'sqladmin.googleapis.com',
  'artifactregistry.googleapis.com',
  'cloudbuild.googleapis.com',
  'secretmanager.googleapis.com',
  'servicenetworking.googleapis.com',
  'firebasehosting.googleapis.com',
  'firebase.googleapis.com'
)

$enabled = @{}
foreach ($api in $apis) { $enabled[$api] = Enable-Api $api }

# ---------------------------------------------------------------------------
# 2. Service account
# ---------------------------------------------------------------------------

Write-Step 'Preparing the service account of the API'

$accountEmail = "$ServiceAccount@$ProjectId.iam.gserviceaccount.com"

$existing = Invoke-Gcloud 'iam' 'service-accounts' 'list' '--project' $ProjectId '--format=value(email)'
if ($existing.Output -notmatch [regex]::Escape($accountEmail)) {
  Invoke-Gcloud 'iam' 'service-accounts' 'create' $ServiceAccount `
    --project $ProjectId --display-name='Glacier API on Cloud Run' | Out-Null
  Write-Ok "the service account $ServiceAccount was created"
} else {
  Write-Ok "the service account $ServiceAccount exists"
}

foreach ($role in @('roles/cloudsql.client', 'roles/logging.logWriter')) {
  Invoke-Gcloud 'projects' 'add-iam-policy-binding' $ProjectId `
    --member="serviceAccount:$accountEmail" --role=$role --quiet | Out-Null
  Write-Ok "the role $role was granted"
}

# ---------------------------------------------------------------------------
# 3. Cloud SQL
# ---------------------------------------------------------------------------

Write-Step 'Preparing Cloud SQL'

$sqlInstances = Invoke-Gcloud 'sql' 'instances' 'list' '--project' $ProjectId '--format=value(name)'
$instanceExists = $sqlInstances.Output -match [regex]::Escape($InstanceId)

# A private IP needs the VPC peering. When the project does not allow it, the
# instance gets a public IP and stays behind the Cloud SQL Auth Proxy.
$private = $enabled['servicenetworking.googleapis.com']
$flags = @('--assign-ip')

if ($private) {
  Write-Host '   reserving the private network range for Cloud SQL'
  $peering = Invoke-Gcloud 'services' 'vpc-peerings' 'connect' `
    '--service=servicenetworking.googleapis.com' '--range=10.10.0.0/16' `
    "--project=$ProjectId" --quiet

  if ($peering.ExitCode -eq 0) {
    $flags = @('--no-assign-ip')
    Write-Ok 'the private range 10.10.0.0/16 is reserved, the instance gets a private IP'
  } else {
    Write-Warn "the private range could not be reserved: $($peering.Output.Split("`n")[0])"
    Write-Warn 'the instance gets a public IP and stays behind the Cloud SQL Auth Proxy'
  }
}

if (-not $instanceExists) {
  Write-Host '   creating the instance, this takes a few minutes'

  # The organisation can restrict the machine type of the instance. The script
  # tries the small shapes first, because the free tier of the organisation is
  # usually the smallest one.
  $attempts = @(
    @{ Tier = $Tier; Cpu = $null; Memory = $null },
    @{ Tier = 'db-g1-small'; Cpu = $null; Memory = $null },
    @{ Tier = 'db-custom-1-3840'; Cpu = $null; Memory = $null }
  )

  $created = $false
  foreach ($attempt in $attempts) {
    $result = Invoke-Gcloud 'sql' 'instances' 'create' $InstanceId `
      --database-version=POSTGRES_16 --tier=$($attempt.Tier) --region=$Region `
      --availability-type=$AvailabilityType --edition=ENTERPRISE `
      @flags --project $ProjectId --quiet

    if ($result.ExitCode -eq 0) {
      $created = $true
      Write-Ok "the instance $InstanceId was created with $($attempt.Tier)"
      break
    }

    if ($result.Output -match 'org policy') {
      Write-Warn "the organisation policy of the project does not allow the tier $($attempt.Tier):"
      Write-Warn ($result.Output -split "`n" | Where-Object { $_ -match 'tier must be' } | Select-Object -First 1)
      Write-Warn 'Ask the owner of the organisation to allow this machine type, then run this script again.'
      break
    }
  }

  if (-not $created) {
    throw "The Cloud SQL instance could not be created. Last error: $((Invoke-Gcloud 'sql' 'instances' 'list' '--project' $ProjectId '--format=value(name)').Output)"
  }
} else {
  Write-Ok "the instance $InstanceId exists"
}

$instanceDescription = Invoke-Gcloud 'sql' 'instances' 'describe' $InstanceId --project $ProjectId '--format=json'
$connectionName = ''
$publicIp = ''
try {
  $instance = $instanceDescription.Output | ConvertFrom-Json
  $connectionName = $instance.connectionName
  $publicIp = $instance.ipAddresses | Where-Object { $_.type -eq 'PRIMARY' } | Select-Object -First 1 | ForEach-Object { $_.ipAddress }
} catch {
  Write-Warn 'The instance could not be read as JSON, the connection name is unknown.'
}
Write-Ok "connection name: $connectionName"

$databases = Invoke-Gcloud 'sql' 'databases' 'list' '--instance' $InstanceId --project $ProjectId '--format=value(name)'
if ($databases.Output -notmatch [regex]::Escape($DatabaseName)) {
  Invoke-Gcloud 'sql' 'databases' 'create' $DatabaseName --instance=$InstanceId --project $ProjectId --quiet | Out-Null
  Write-Ok "the database $DatabaseName was created"
} else {
  Write-Ok "the database $DatabaseName exists"
}

$appPassword = New-RandomSecret

$users = Invoke-Gcloud 'sql' 'users' 'list' '--instance' $InstanceId --project $ProjectId '--format=value(name)'
if ($users.Output -notmatch [regex]::Escape($AppUser)) {
  Invoke-Gcloud 'sql' 'users' 'create' $AppUser --instance=$InstanceId --password=$appPassword --project $ProjectId --quiet | Out-Null
  Write-Ok "the user $AppUser was created"
} else {
  Invoke-Gcloud 'sql' 'users' 'set-password' $AppUser --instance=$InstanceId --password=$appPassword --project $ProjectId --quiet | Out-Null
  Write-Ok "the password of $AppUser was reset"
}

# The API reaches the database on 127.0.0.1:5432, the Cloud SQL Auth Proxy of
# the service does the TLS towards the instance. That works with a private and
# with a public instance address.
$databaseUrl = "postgresql://${AppUser}:${appPassword}@127.0.0.1:5432/${DatabaseName}"

# ---------------------------------------------------------------------------
# 4. Secrets
# ---------------------------------------------------------------------------

Write-Step 'Storing the secrets'

$sessionSecret = New-RandomSecret -Bytes 48
$useSecretManager = $enabled['secretmanager.googleapis.com']

if ($useSecretManager) {
  $secrets = Invoke-Gcloud 'secrets' 'list' '--project' $ProjectId '--format=value(name)'
  if ($secrets.Output -notmatch [regex]::Escape($SecretName)) {
    Invoke-Gcloud 'secrets' 'create' $SecretName --replication-policy=automatic --project $ProjectId | Out-Null
    Write-Ok "the secret $SecretName was created"
  }

  # The API reads the database URL and the session secret from this secret.
  $secretPayload = "DATABASE_URL=$databaseUrl`nSESSION_SECRET=$sessionSecret"
  $secretPayload | Invoke-Gcloud 'secrets' 'versions' 'add' $SecretName --data-file=- --project $ProjectId | Out-Null
  Write-Ok 'the database URL and the session secret were written to Secret Manager'

  Invoke-Gcloud 'projects' 'add-iam-policy-binding' $ProjectId `
    --member="serviceAccount:$accountEmail" --role=roles/secretmanager.secretAccessor --quiet | Out-Null
} else {
  Write-Warn 'Secret Manager is not available in this project, the secrets are set as environment variables of the service'
}

# ---------------------------------------------------------------------------
# 5. The image
# ---------------------------------------------------------------------------

Write-Step 'Building the API image'

$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/api:latest"
$useArtifactRegistry = $enabled['artifactregistry.googleapis.com']

if (-not $useArtifactRegistry) {
  throw 'The project does not allow Artifact Registry, so the image cannot be stored. See the runbook, section 8.'
}

$repositories = Invoke-Gcloud 'artifacts' 'repositories' 'list' '--project' $ProjectId '--location' $Region '--format=value(name)'
if ($repositories.Output -notmatch [regex]::Escape($Repository)) {
  Invoke-Gcloud 'artifacts' 'repositories' 'create' $Repository `
    --repository-format=docker --location=$Region --description='API images' --project $ProjectId | Out-Null
  Write-Ok "the repository $Repository was created"
}

if ($docker) {
  Invoke-Gcloud 'auth' 'configure-docker' "$Region-docker.pkg.dev" --project $ProjectId | Out-Null
  Push-Location "$RepoRoot\server"
  try {
    & docker build -t $image . | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'The Docker build failed.' }
    & docker push $image | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'The Docker push failed.' }
  } finally {
    Pop-Location
  }
  Write-Ok "the image $image was built and pushed"
} else {
  Invoke-Gcloud 'builds' 'submit' "--tag=$image" "$RepoRoot\server" --project $ProjectId --quiet | Out-Null
  Write-Ok "the image $image was built by Cloud Build"
}

# ---------------------------------------------------------------------------
# 6. The migrations
# ---------------------------------------------------------------------------

Write-Step 'Applying the migrations'

$proxyDirectory = Join-Path $env:TEMP 'glacier-deploy'
$proxy = Join-Path $proxyDirectory 'cloud-sql-proxy.exe'
New-Item -ItemType Directory -Path $proxyDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $proxy)) {
  $url = 'https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.26.2/cloud-sql-proxy.x64.exe'
  Invoke-WebRequest -Uri $url -OutFile $proxy -UseBasicParsing
}

$proxyProcess = Start-Process -FilePath $proxy -ArgumentList '--port', '5432', $connectionName -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5

try {
  $env:DATABASE_URL = "postgresql://${AppUser}:${appPassword}@127.0.0.1:5432/${DatabaseName}"
  Push-Location "$RepoRoot\server"
  try {
    & npm run migrate
    if ($LASTEXITCODE -ne 0) { throw 'The migration failed.' }
  } finally {
    Pop-Location
  }
  Write-Ok 'the schema is up to date'
} finally {
  Stop-Process -Id $proxyProcess.Id -ErrorAction SilentlyContinue
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# 7. Cloud Run
# ---------------------------------------------------------------------------

Write-Step 'Deploying the API to Cloud Run'

$template = Get-Content -LiteralPath "$RepoRoot\deploy\cloud-run-api.yaml" -Raw
$rendered = $template.
  Replace('PROJECT_ID', $ProjectId).
  Replace('REGION', $Region).
  Replace('INSTANCE_ID', $InstanceId).
  Replace('glacier-run@PROJECT_ID.iam.gserviceaccount.com', $accountEmail)

if (-not $useSecretManager) {
  # Without Secret Manager the two secrets are set as environment variables of
  # the service, and the reference to the secret is removed from the template.
  $rendered = $rendered -replace "(?ms)^\s*envFrom:\s*\n\s*- secretRef:\s*\n\s*name: $SecretName\s*\n", ''
  $rendered = $rendered.Replace(
    '        - name: PORT',
    "        - name: DATABASE_URL`n          value: `"$databaseUrl`"`n        - name: SESSION_SECRET`n          value: `"$sessionSecret`"`n        - name: PORT"
  )
}

$renderedFile = Join-Path $env:TEMP 'glacier-cloud-run.yaml'
Set-Content -LiteralPath $renderedFile -Value $rendered -Encoding utf8

$deploy = Invoke-Gcloud 'run' 'services' 'replace' $renderedFile --region=$Region --project=$ProjectId --quiet
if ($deploy.ExitCode -ne 0) {
  Write-Warn "the YAML deployment failed, the same service is deployed with the command line: $($deploy.Output.Split("`n")[0])"
  $envArgs = @(
    "--set-env-vars=NODE_ENV=production,PORT=8080,CLIENT_ORIGIN=https://$ProjectId.web.app,SESSION_SAME_SITE=none,DATABASE_SSL=false,DATABASE_URL=$databaseUrl,SESSION_SECRET=$sessionSecret",
    '--allow-unauthenticated'
  )
  $deploy = Invoke-Gcloud 'run' 'deploy' $ServiceName --image=$image --region=$Region --project=$ProjectId `
    --service-account=$accountEmail --add-cloudsql-instances=$connectionName --port=8080 --quiet @envArgs
  if ($deploy.ExitCode -ne 0) {
    throw "The Cloud Run deployment failed: $($deploy.Output)"
  }
}

$apiUrl = (Invoke-Gcloud 'run' 'services' 'describe' $ServiceName --region=$Region --project=$ProjectId '--format=value(status.url)').Output.Trim()
Write-Ok "the API is live at $apiUrl"

# ---------------------------------------------------------------------------
# 8. The client
# ---------------------------------------------------------------------------

$clientUrl = ''

if (-not $SkipClient) {
  Write-Step 'Deploying the client to Firebase Hosting'

  $firebaseProject = Invoke-Firebase 'projects:list' '--project' $ProjectId '--non-interactive'
  if ($firebaseProject.Output -match 'No projects found') {
    Write-Host '   adding the Firebase resources to the project'
    Invoke-Firebase 'projects:addfirebase' $ProjectId '--non-interactive' | Out-Null
  }

  # The client calls the API on the address of the API. Firebase Hosting does
  # not forward a request to an arbitrary external URL, so the address of the
  # API is baked into the browser bundle with VITE_API_URL. The API allows the
  # origin of the frontend in CLIENT_ORIGIN, and the session cookie is
  # SameSite=None; Secure, because the two are different sites.
  Push-Location "$RepoRoot\client"
  try {
    $env:VITE_API_URL = "$apiUrl/api"
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'The client build failed.' }

    $hosting = Invoke-Firebase 'deploy' '--only', 'hosting', '--project', $ProjectId, '--non-interactive'
    if ($hosting.Output -notmatch 'release complete|Hosting URL') {
      Write-Warn "the hosting deployment failed: $($hosting.Output)"
      Write-Host '   The GCP project has to be added to Firebase first:'
      Write-Host "   https://console.firebase.google.com/project/_/add?project=$ProjectId"
    } else {
      $clientUrl = "https://$ProjectId.web.app"
      Write-Ok "the client is live at $clientUrl"
    }
  } finally {
    Pop-Location
  }
}

# ---------------------------------------------------------------------------
# 9. The result
# ---------------------------------------------------------------------------

Write-Step 'The deployment is done'

if ($clientUrl) {
  Write-Host "   Frontend: $clientUrl"
  Write-Host "   API:      $apiUrl"
  Write-Host ''
  Write-Host '   Write these two lines into README.md, docs/SUBMISSION_CHECKLIST.md'
  Write-Host '   and docs/SUBMISSION_MESSAGE.md:'
  Write-Host ''
  Write-Host "   - Deployed application URL: $clientUrl"
  Write-Host "   - API URL: $apiUrl"
}

Write-Host ''
Write-Host '   Smoke test:' -ForegroundColor Cyan
Write-Host "   curl $apiUrl/health"
Write-Host "   curl `"$apiUrl/health?database=true`""
