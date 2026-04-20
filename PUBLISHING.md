# Publishing SignSpark to Azure

SignSpark is hosted on **Azure Static Web Apps** (Free tier).

| Setting         | Value                                              |
|-----------------|----------------------------------------------------|
| App name        | `<your-app-name>`                                  |
| Resource group  | `<your-resource-group>`                            |
| Region          | `westus2`                                          |
| Hostname        | `<your-hostname>.azurestaticapps.net`              |
| Subscription    | `<your-subscription-name>`                         |

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

### 4. Deploy with StaticSitesClient

The SWA CLI's `swa deploy` command uses StaticSitesClient internally. For reliable deployment, invoke it directly:

```powershell
$client = (Get-ChildItem -Path "$env:USERPROFILE\.swa\deploy" -Recurse -Filter "StaticSitesClient.exe" | Select-Object -First 1).FullName

# IMPORTANT: Run from a directory OUTSIDE the app folder
cd $env:USERPROFILE

& $client upload `
  --app "<path-to-your-repo>" `
  --outputLocation "." `
  --apiToken $token `
  --skipAppBuild true `
  --verbose
```

> **⚠️ Key detail**: The working directory must be *different* from the app folder. If you run from inside the app folder, you'll get: `"Current directory cannot be identical to or contained within artifact folders."`

### 5. Verify the deployment

```powershell
# Check HTML loads with app content
$r = Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net" -UseBasicParsing
$r.Content -match "SignSpark"  # Should return True

# Check assets are serving
Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net/data/words.json" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://<your-hostname>.azurestaticapps.net/css/style.css" -UseBasicParsing | Select-Object StatusCode
```

---

## Alternative: Using swa deploy (simpler but less reliable)

If StaticSitesClient.exe is not available, you can try the SWA CLI wrapper. Note: this has been unreliable in testing — it exits with code 0 but may not upload files.

```powershell
cd <path-to-your-repo>
swa deploy . --deployment-token $token --env production
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
| "Current directory cannot be identical to artifact folders" | `cd` to a different directory before running StaticSitesClient. |
| StaticSitesClient.exe not found | Run `swa deploy` once — it downloads the client to `~/.swa/deploy/`. |
| 404 on assets (CSS/JS/images) | Check that the deploy included all subdirectories. Re-deploy with `--verbose`. |
| Login expired | Run `az login --use-device-code` again. |

---

## Quick Deploy Script

Copy-paste this for a one-command deploy:

```powershell
cd $env:USERPROFILE
$token = az staticwebapp secrets list --name <your-app-name> --resource-group <your-resource-group> --query "properties.apiKey" -o tsv
$client = (Get-ChildItem -Path "$env:USERPROFILE\.swa\deploy" -Recurse -Filter "StaticSitesClient.exe" | Select-Object -First 1).FullName
& $client upload --app "<path-to-your-repo>" --outputLocation "." --apiToken $token --skipAppBuild true --verbose
```
