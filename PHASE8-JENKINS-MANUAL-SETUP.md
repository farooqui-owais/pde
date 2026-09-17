# Phase 8 — Jenkins Manual Setup Guide

Jenkins is running at **http://localhost:8080** using the custom **`jenkins-pde`** image, which has Docker CLI, Python 3.11, and Node.js pre-installed.

> **Important**: Always use `jenkins-pde:latest` for this stack. The stock `jenkins/jenkins:lts` image does not have Docker CLI and cannot run the build pipeline. If Jenkins was started with the stock image, stop and recreate it (see step 0 below).

---

## Step 0 — Verify You're Running the Custom Image

```powershell
docker inspect jenkins --format "{{.Config.Image}}"
# Expected output: jenkins-pde:latest
```

If the output is `jenkins/jenkins:lts` or similar, recreate the container:

```powershell
# Build the custom image (run from repo root):
docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .

# Stop and remove the old container:
docker stop jenkins && docker rm jenkins

# Start fresh with the custom image (jenkins_home volume is preserved):
docker run -d `
    --name jenkins `
    --network kind `
    --group-add 0 `
    -p 8080:8080 -p 50000:50000 `
    -v jenkins_home:/var/jenkins_home `
    -v //var/run/docker.sock://var/run/docker.sock `
    jenkins-pde:latest

# Unlock key (if this is a fresh jenkins_home volume):
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

> **`//var/run/docker.sock://var/run/docker.sock`**: double slashes are required in PowerShell/Git Bash on Windows (Docker Desktop). On Linux/macOS use single slashes.

---

## Step 1 — Access Jenkins UI

1. Open **http://localhost:8080**
2. You should see the Jenkins dashboard (already unlocked and initialized from the previous session — if not, use the unlock password from `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`)

---

## Step 2 — Add Git Credential

The pipeline pushes image tag updates back to your git repository. It needs a Personal Access Token with **`repo` write scope**.

1. **Manage Jenkins** → **Credentials** → **System** → **Global credentials (unrestricted)**
2. Click **Add Credentials**
3. Fill in:
   - **Kind**: `Username with password`
   - **Username**: your GitHub username (e.g. `farooqui-owais`)
   - **Password**: your GitHub Personal Access Token
     - Go to [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic)
     - Scope: tick **`repo`** (full control of private repositories)
   - **ID**: **`git-creds`** ← must match exactly; the Jenkinsfile references this ID
   - **Description**: `GitHub PAT for PDE pipeline`
4. Click **Create**

> **Never commit your PAT to the repo.** Jenkins stores it encrypted in `jenkins_home`.

---

## Step 3 — Create the Pipeline Job

1. **New Item** → Name: **`pde-local`** → **Pipeline** → **OK**
2. Scroll to the **Pipeline** section
3. **Definition**: `Pipeline script from SCM`
4. Fill in:
   - **SCM**: `Git`
   - **Repository URL**: `https://github.com/farooqui-owais/pde.git` (or your fork URL)
   - **Credentials**: `git-creds` (the one you just created)
   - **Branches to build**: `*/main`
   - **Script Path**: `local-k8s/Jenkinsfile.k8s`
5. Click **Save**

> **Automatic triggering**: the Jenkinsfile declares `triggers { pollSCM('H/5 * * * *') }`,
> so once the job has run once, Jenkins polls GitHub every ~5 minutes and builds
> automatically on new `main` commits — no manual "Build Now" required. A GitHub
> webhook to `http://<jenkins>:8080/github-webhook/` is the zero-latency alternative.

---

## Step 4 — Run the Pipeline

1. Click **Build Now** in the left sidebar
2. Click the build number in **Build History** to open it
3. Click **Console Output** to follow live logs

### What the pipeline does

| Stage | Action |
|---|---|
| Checkout | Clones the repo from your configured SCM |
| Backend Quality Gate | Runs `ruff check` + `pytest` inside a `python:3.11-slim` Docker container (isolated, matches prod image) |
| Frontend Quality Gate | Runs `npm ci` + `npm run build` on the Jenkins agent (Node.js pre-installed in the custom image) |
| Build & Push Images | `docker build` + `docker push` both backend and frontend to `localhost:5000` |
| Bump Image Tags for ArgoCD | Edits `helm/pde/values-local.yaml` with the new tag, commits, and pushes to your repo |

**On success**: ArgoCD detects the commit in ~3 minutes and rolls out new pods automatically.

---

## Step 5 — Verify the Full CI/CD Loop

After a successful pipeline run:

**1. Check new image tag in values file:**
```powershell
git pull
Select-String "tag:" helm\pde\values-local.yaml
# Expected: both tag lines show e.g. "tag: 3-a1b2c3d"
```

**2. Check ArgoCD is syncing:**
```
https://localhost:8081
Login: admin / <retrieve dynamically — see below>
```
Retrieve ArgoCD password (PowerShell):
```powershell
$b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
```
The `pde` app tile should show **Synced + Healthy** (green) after ~3 minutes.

**3. Check new pods:**
```powershell
kubectl get pods -n pde -w
# New pods with recent AGE appear; old ones terminate
```

**4. Verify the app:**
```
http://pde.local
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `docker: command not found` in build | Wrong Jenkins image (stock `lts` instead of `jenkins-pde`) | See Step 0 above — rebuild and restart with `jenkins-pde:latest` |
| `git push` fails with 403 | Token missing `repo` scope, or credential ID doesn't match `git-creds` | Re-check the GitHub PAT scopes; verify credential ID is exactly `git-creds` |
| `git push` fails with "could not read Username" | Non-interactive shell can't prompt — URL doesn't have credentials | Verify Jenkinsfile.k8s is the fixed version (authenticated URL via `withCredentials`) |
| Backend tests fail (DB connection error) | `DATABASE_URL` not set before test run | Verify Jenkinsfile.k8s passes `-e DATABASE_URL="sqlite:///:memory:"` to the docker run command |
| Registry push fails (connection refused) | `kind-registry` not on the `kind` Docker network | `docker network connect kind kind-registry` |
| `ruff check` fails | Linting error in `app/` | Fix the reported lint error in `pde-backend/app/` and push |
| Pipeline stuck at checkout | Wrong branch name or repo URL | Verify `*/main` branch and repo URL in the job config |
