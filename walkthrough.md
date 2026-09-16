# CI/CD Pipeline Fix — Walkthrough

All fixes are **applied and verified in the code**. This doc explains each fix, how to
rebuild/restart Jenkins, and how to verify the pipeline end-to-end.

For the full issue→root-cause matrix, see [implementation plan.md](implementation%20plan.md).

---

## Files Changed

| File | Type | Fixes |
|---|---|---|
| `local-k8s/jenkins/Dockerfile` | 🔴 Critical | Removed `docker-cli` conflict, socket permissions, self-documenting header |
| `local-k8s/jenkins/plugins.txt` | 🟡 Major | 5 → 9 plugins |
| `local-k8s/Jenkinsfile.k8s` | 🔴 Critical ×4 | git push auth, sed precision, cleanWs policy, SQLite env vars |
| `local-k8s/scripts/restart-stack.ps1` | 🟡 Major | Removed hardcoded IP |
| `local-k8s/scripts/start-port-forwards.ps1` | 🟢 Minor | Removed hardcoded password |
| `local-k8s/README.md` | 📄 Doc | Full rewrite — consistent `jenkins-pde` image |
| `PHASE8-JENKINS-MANUAL-SETUP.md` | 📄 Doc | Full rewrite — Step 0 image verify, Windows paths, troubleshooting table |
| `local-k8s/scripts/RECOVERY-CHECKPOINT.md` | 📄 Doc | Full rewrite — Phase 8 consistency, removed workarounds |

---

## Fix Details

### 🔴 Fix 1 — Jenkins Dockerfile: Conflicting `docker-cli` Package Removed

**Before:**
```dockerfile
RUN apt-get install -y docker.io docker-cli  # ← conflict! two Docker CLI providers
```

**After:**
```dockerfile
RUN apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip nodejs npm \
        docker.io curl \
    && usermod -aG docker jenkins \
    && usermod -aG root jenkins         # ← group 0 for Docker Desktop socket
```

**Why**: `docker.io` and `docker-cli` both provide the Docker CLI on Debian; installing
both conflicts. `docker.io` is the correct Debian package. `curl` added for health
probes. `usermod -aG root jenkins` gives group-0 access to Docker Desktop's
`root:root`-owned socket.

---

### 🔴 Fix 2 — Jenkinsfile: Backend Quality Gate Passes Required Env Vars

**Before:** the `docker run` for `python:3.11-slim` set no environment variables.

**After:**
```groovy
docker run --rm \
    -v "$(pwd)/pde-backend:/app" -w /app \
    -e DATABASE_URL="sqlite:///:memory:" \
    -e DEBUG="True" \
    -e SECRET_KEY="ci-test-secret-key-32-chars-long!" \
    python:3.11-slim sh -c '...'
```

**Why**: `_init_db()` runs at import time in `app/main.py:148`. If `DATABASE_URL`
isn't set before `app.main` is imported, pytest blocks up to 15 seconds retrying a
Postgres connection, then fails. `conftest.py` also sets these, but passing them as
`docker run -e` flags guarantees they exist before any import.

---

### 🔴 Fix 3 — Jenkinsfile: Context-Aware `sed` for Tag Replacement

**Before:**
```bash
sed -i "s/^\(\s*tag:\).*/\1 ${IMAGE_TAG}/" values-local.yaml
# ↑ matches ANY "tag:" line — fragile
```

**After:**
```bash
# Replace only the tag under the backend.image block:
sed -i '/repository:.*\/pde\/backend/{n; s|^\(\s*tag:\).*|\1 ${IMAGE_TAG}|}' values-local.yaml
# Same for frontend:
sed -i '/repository:.*\/pde\/frontend/{n; s|^\(\s*tag:\).*|\1 ${IMAGE_TAG}|}' values-local.yaml
```

**Why**: sed's `n` command advances to the next line only when inside the correct
`repository:` block — surgical, so `targetRevision:` or chart `tag:` keys can never
be touched.

---

### 🔴 Fix 4 — Jenkinsfile: Git Push Actually Injects Credentials

**Before:**
```groovy
withCredentials([usernamePassword(...)]) {
    sh "git push ${GIT_REPO_URL} HEAD:main"
    // ↑ GIT_USER/GIT_TOKEN retrieved but never used in the URL → 403
}
```

**After:**
```groovy
withCredentials([usernamePassword(
    credentialsId: "git-creds",
    usernameVariable: 'GIT_USER',
    passwordVariable: 'GIT_TOKEN'
)]) {
    sh """
        AUTHENTICATED_URL=\$(echo "${GIT_REPO_URL}" | sed "s|https://|https://\${GIT_USER}:\${GIT_TOKEN}@|")

        // Environment branch, NOT main — bump commits never touch main or
        // re-trigger CI. deploy/local is force-updated (pointer branch).
        git push --force "\${AUTHENTICATED_URL}" HEAD:deploy/local
    """
}
```

**Why**: `withCredentials` exposes variables but they must be *used*. The push URL
embeds the token (`https://user:token@github.com/...`); Jenkins masks `GIT_TOKEN`
in logs so it never appears in plaintext. The commit message carries `[skip ci]`
as a belt-and-braces guard. The push targets the `deploy/local` **environment
branch** (see GITHUB-ACTIONS.md § Branch Strategy) so the GitOps boundary stays
isolated from `main`.

---

### 🔴 Fix 5 — Jenkinsfile: `cleanWs()` Only on Success

**Before:**
```groovy
post { always { cleanWs() } }   // ← deletes workspace even when build fails
```

**After:**
```groovy
post {
    success { cleanWs() }
    failure { echo "... workspace preserved for debugging ..." }
}
```

**Why**: Cleaning on failure destroys the workspace before you can inspect what went
wrong. Failed builds now leave the workspace intact, and the `failure` block prints
the three most common causes (lint/test errors, registry unreachable, expired token).

---

### 🟡 Fix 6 — `restart-stack.ps1`: Removed Hardcoded IP `172.18.0.2`

**After**: the IP check / network-reconnect logic was removed entirely — Docker
Desktop assigns kind-node IPs dynamically, so hardcoding one was unreliable. If the
kubeconfig is stale, the script now directs you to run
`kind export kubeconfig --name pde-dev`.

---

### 🟡 Fix 7 — Jenkins Plugins: Added Missing Plugins

**Before:** 5 plugins (git, workflow-aggregator, credentials-binding, docker-workflow, ws-cleanup)

**After:** 9 plugins — added `pipeline-stage-view` (build UI), `plain-credentials`,
`docker-commons`, `github`. Note: `blueocean` was intentionally **not** added
(optional UI add-on, heavy); add it to `plugins.txt` if you want it.

---

### 🟢 Fix 8 — `start-port-forwards.ps1`: Removed Hardcoded Password

**Before:**
```powershell
Write-Host "  - ArgoCD: https://localhost:8081  (admin / 1qDaoHvyKurDzxoR)"
# ↑ Actual password hardcoded in a committed script file
```

**After:** the script prints the dynamic retrieval command instead:
```powershell
$b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
```

---

## Documentation Overhaul

All three docs now consistently use the **`jenkins-pde:latest`** custom image:

| Doc | Old (broken) | New (fixed) |
|---|---|---|
| `README.md §9` | `docker run jenkins/jenkins:lts` + "install Docker manually" | `docker run jenkins-pde:latest` (Docker already in image) |
| `PHASE8-JENKINS-MANUAL-SETUP.md` | No image check | Step 0 verifies the image before anything else |
| `RECOVERY-CHECKPOINT.md Phase 8` | `jenkins/jenkins:lts` + `apt-get install docker.io` workaround | `jenkins-pde:latest`, build instructions, no workaround |

All docs use **`//var/run/docker.sock://var/run/docker.sock`** (double slashes) for
Windows Docker Desktop — the single-slash form can fail under Git Bash MSYS path
translation — plus `--group-add 0`.

---

## How to Apply (Rebuild Jenkins)

The Jenkins Dockerfile was fixed — rebuild the image before your next run:

```powershell
cd C:\Users\Home\Desktop\project\PDE

# Rebuild the custom Jenkins image
docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .

# If Jenkins is running with the old image, recreate it
# (jenkins_home volume is preserved — jobs and credentials survive)
docker stop jenkins && docker rm jenkins
docker run -d `
    --name jenkins `
    --network kind `
    --group-add 0 `
    -p 8080:8080 -p 50000:50000 `
    -v jenkins_home:/var/jenkins_home `
    -v //var/run/docker.sock://var/run/docker.sock `
    jenkins-pde:latest
```

Then trigger the `pde-local` pipeline — all 5 stages should pass cleanly.

---

## Verification Checklist

- [ ] `docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .` — succeeds, prints Python 3.11, Node, Docker versions
- [ ] Jenkins container starts; UI accessible at `http://localhost:8080`
- [ ] `docker exec jenkins docker ps` — shows host containers (Docker socket works)
- [ ] Pipeline **Backend Quality Gate** passes (ruff + pytest green, no 15s DB retry)
- [ ] Pipeline **Frontend Quality Gate** passes (npm ci + build succeeds)
- [ ] Pipeline **Build & Push Images** succeeds (`curl http://localhost:5000/v2/_catalog` shows both repos)
- [ ] Pipeline **Bump Image Tags** commits and pushes (`git log` shows the `[skip ci]` bump commit)
- [ ] ArgoCD detects the push and syncs within ~3 minutes
- [ ] `kubectl get pods -n pde` — all pods Running with the new image tags
- [ ] `http://pde.local` — application loads
- [ ] `http://localhost:3000` — Grafana shows live metrics