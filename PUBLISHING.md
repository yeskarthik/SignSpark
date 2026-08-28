# Publishing SignSpark to Azure

SignSpark is hosted on **Azure Static Web Apps** (Free tier).

| Setting         | Value                                              |
|-----------------|----------------------------------------------------|
| App name        | `signspark`                                        |
| Resource group  | `signspark-rg`                                     |
| Region          | `westus2`                                          |
| Hostname        | `lemon-rock-07f946f1e.7.azurestaticapps.net`       |
| Subscription    | `0648b1a1-e377-4bc7-b768-8f3c62ed3c05`           |
| Storage account | `signsparkdata3c05`                                |
| Profile table   | `SignSparkProfiles`                                |
| Video reports   | `SignSparkVideoReports`                            |

---

## Prerequisites

- **Azure CLI** installed (`az --version`)
- **Node.js** installed (for SWA CLI)
- **Azure Static Web Apps CLI** installed:
  ```bash
  npm install -g @azure/static-web-apps-cli
  ```

---

## Step-by-Step Deployment

### 1. Log in to Azure

```powershell
az login --use-device-code
```

Follow the on-screen instructions to authenticate.

### 2. Verify subscription

```powershell
az account show --query "{name:name, id:id}" -o table
```

If the wrong subscription is selected:
```powershell
az account set --subscription "<your-subscription-name>"
```

### 3. Get the deployment token

```powershell
$token = az staticwebapp secrets list --name <your-app-name> --resource-group <your-resource-group> --query "properties.apiKey" -o tsv
```

### 4. Create a clean deployment artifact

Never pass the repository root directly to StaticSitesClient. The client can
remove excluded metadata such as `.git` while preparing the artifact.

```powershell
$repo = "C:\personal\projects\SignSpark"
$artifact = Join-Path $env:TEMP ("signspark-deploy-" + [guid]::NewGuid())
$appArtifact = Join-Path $artifact "app"
$apiArtifact = Join-Path $artifact "api"
New-Item -ItemType Directory -Path $appArtifact, $apiArtifact | Out-Null

Copy-Item "$repo\index.html", "$repo\staticwebapp.config.json" $appArtifact
foreach ($directory in @("assets", "css", "data", "js")) {
    Copy-Item "$repo\$directory" $appArtifact -Recurse
}

Copy-Item "$repo\api\host.json", "$repo\api\package.json", "$repo\api\package-lock.json" $apiArtifact
Copy-Item "$repo\api\profiles" $apiArtifact -Recurse
Copy-Item "$repo\api\video-reports" $apiArtifact -Recurse
```

### 5. Deploy with StaticSitesClient

The SWA CLI's `swa deploy` command uses StaticSitesClient internally. For reliable deployment, invoke it directly:

```powershell
$null = npm ci --omit=dev --prefix $apiArtifact --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "API dependency installation failed." }

$client = (Get-ChildItem -Path "$env:USERPROFILE\.swa\deploy" -Recurse -Filter "StaticSitesClient.exe" | Select-Object -First 1).FullName

# IMPORTANT: Run from a directory OUTSIDE the app folder
cd $env:USERPROFILE

& $client upload `
  --app $appArtifact `
  --api $apiArtifact `
  --outputLocation "." `
  --apiToken $token `
  --skipAppBuild true `
  --skipApiBuild true `
  --verbose

Remove-Item -LiteralPath $artifact -Recurse -Force
```

> **Key details**: Run the client outside both the repository and artifact
> directories. Stage the frontend and API separately; never include `.git`,
> local settings, or the repository's `api/node_modules`. Run
> `npm ci --omit=dev --prefix $apiArtifact` before upload so the isolated API
> artifact contains its production dependencies.

### 6. Verify the deployment

```powershell
# Check HTML loads with app content
$r = Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net" -UseBasicParsing
$r.Content -match "SignSpark"  # Should return True

# Check assets are serving
Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net/data/words.json" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net/css/style.css" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net/api/profiles/Kar" -UseBasicParsing | Select-Object StatusCode
```

---

## Alternative: Using swa deploy (simpler but less reliable)

If StaticSitesClient.exe is not available, you can try the SWA CLI wrapper. Note: this has been unreliable in testing — it exits with code 0 but may not upload files.

```powershell
cd <path-to-your-repo>
swa deploy . --api-location api --deployment-token $token --env production
```

---

## Creating the Azure Resources from Scratch

If you need to recreate the Static Web App:

```powershell
# Create resource group
az group create --name <your-resource-group> --location westus2

# Create Static Web App (Free tier, no GitHub integration)
az staticwebapp create `
  --name <your-app-name> `
  --resource-group <your-resource-group> `
  --location westus2 `
  --sku Free `
  --branch main `
  --app-location "/" `
  --output-location "." `
  --login-with-github false
```

Then follow steps 3-5 above to deploy.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Site shows default Azure placeholder | Deployment didn't upload files. Re-run StaticSitesClient from a parent directory. |
| `swa deploy` exits 0 but site unchanged | Use StaticSitesClient.exe directly instead of the SWA CLI wrapper. |
| "Current directory cannot be identical to artifact folders" | Run StaticSitesClient outside both the repository and staged artifact. |
| Local `.git` metadata disappears | Never upload the repository root; create the clean runtime artifact in Step 4. |
| StaticSitesClient.exe not found | Run `swa deploy` once — it downloads the client to `~/.swa/deploy/`. |
| 404 on assets (CSS/JS/images) | Check that the deploy included all subdirectories. Re-deploy with `--verbose`. |
| Login expired | Run `az login --use-device-code` again. |

---

## Quick Deploy Script

Copy-paste this for a one-command deploy:

```powershell
cd $env:USERPROFILE
$repo = "C:\personal\projects\SignSpark"
$artifact = Join-Path $env:TEMP ("signspark-deploy-" + [guid]::NewGuid())
$appArtifact = Join-Path $artifact "app"
$apiArtifact = Join-Path $artifact "api"
New-Item -ItemType Directory -Path $appArtifact, $apiArtifact | Out-Null
Copy-Item "$repo\index.html", "$repo\staticwebapp.config.json" $appArtifact
foreach ($directory in @("assets", "css", "data", "js")) {
    Copy-Item "$repo\$directory" $appArtifact -Recurse
}
Copy-Item "$repo\api\host.json", "$repo\api\package.json", "$repo\api\package-lock.json" $apiArtifact
Copy-Item "$repo\api\profiles" $apiArtifact -Recurse
Copy-Item "$repo\api\video-reports" $apiArtifact -Recurse
npm ci --omit=dev --prefix $apiArtifact --no-audit --no-fund

$token = az staticwebapp secrets list --name signspark --resource-group signspark-rg --query "properties.apiKey" -o tsv
$client = (Get-ChildItem -Path "$env:USERPROFILE\.swa\deploy" -Recurse -Filter "StaticSitesClient.exe" | Select-Object -First 1).FullName
& $client upload --app $appArtifact --api $apiArtifact --outputLocation "." --apiToken $token --skipAppBuild true --skipApiBuild true --verbose
Remove-Item -LiteralPath $artifact -Recurse -Force
```
