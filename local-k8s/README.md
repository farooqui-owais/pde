# PDE (DakhalNama) — Local Kubernetes CI/CD Setup

Full local stack: **kind** (Kubernetes-in-Docker) + **local Docker registry** + **ingress-nginx** + **Jenkins** (CI) + **ArgoCD** (GitOps CD) + **Prometheus/Grafana** (observability). Zero cloud account required.

---

## Architecture Overview

```
  ┌──────────────────────────────────────────────────────────────────┐
  │  Developer Machine (Docker Desktop for Windows)                   │
  │                                                                    │
  │  ┌─────────────┐    push image     ┌──────────────────┐           │
  │  │  Jenkins     │──────────────────▶│  kind-registry   │           │
  │  │  (container) │                   │  localhost:5000   │           │
  │  │             │   git push        └────────┬─────────┘           │
  │  │             │──────────────────▶ GitHub  │ pull                 │
  │  └─────────────┘                    repo    │                      │
  │                                     │       │                      │
  │  ┌──────────────────────────────────▼───────▼─────────────────┐  │
  │  │  kind cluster "pde-dev"                                      │  │
  │  │                                                              │  │
  │  │  ┌──────────┐  detects git change  ┌──────────────────────┐ │  │
  │  │  │ ArgoCD   │◀─────────────────────│  helm/pde/           │ │  │
  │  │  │ (argocd) │     values-local.yaml│  values-local.yaml   │ │  │
  │  │  └────┬─────┘                      └──────────────────────┘ │  │
  │  │       │ deploys                                              │  │
  │  │  ┌────▼──────────────────────────────────┐                  │  │
  │  │  │  namespace: pde                        │                  │  │
  │  │  │  postgres / pde-backend / pde-frontend │                  │  │
  │  │  └───────────────────────────────────────┘                  │  │
  │  │                                                              │  │
  │  │  ┌─────────────────────────────┐                            │  │
  │  │  │  namespace: monitoring       │                            │  │
  │  │  │  Prometheus + Grafana        │                            │  │
  │  │  └─────────────────────────────┘                            │  │
  │  └──────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────┘
```

**CI/CD boundary**: Jenkins builds + pushes images and bumps image tags in `values-local.yaml`. ArgoCD detects the commit and syncs the cluster. Jenkins never runs `helm upgrade` or `kubectl apply` for the app.

---

## Files Changed in Your Project

| File | Change | Why |
|---|---|---|
| `pde-backend/requirements.txt` | added `prometheus-fastapi-instrumentator==7.0.0` | exposes `/metrics` endpoint so Prometheus can scrape the backend |
| `pde-backend/app/main.py` | added `Instrumentator().instrument(app).expose(...)` | actually exposes `/metrics` — the scrape job in `prometheus-values.yaml` would silently get 404s without this |
| `pde-frontend/src/api/axios.js` | `\|\|` → `??` for `VITE_API_BASE_URL` fallback | lets the prod image ship an intentionally empty base URL (same-origin `/api` proxy) without falling back to `localhost:8000` |
| `pde-frontend/Dockerfile.prod` | new file | the Helm chart's `frontend-deployment.yaml` expects port 80 + `/nginx-health`; the existing `Dockerfile` runs the Vite dev server on port 5173 — that mismatch meant Helm would never work. `Dockerfile.prod` is a multi-stage nginx build. The original `Dockerfile` + `docker-compose.yml` are untouched |
| `helm/pde/values-local.yaml` | new file | kind/local-registry/ingress-nginx overrides for the local cluster |
| `monitoring/prometheus-values-local.yaml` | new file | laptop-sized kube-prometheus-stack (small storage, no SMTP) |
| `local-k8s/**` | new directory | everything below: kind config, registry/dashboard scripts, Jenkinsfile, ArgoCD Application manifest, Jenkins custom image |

Nothing in `on-premise/`, `aws/`, `deploy/`, or the original `k8s/*.yaml` was touched.

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Docker Desktop | 4.x | `docker --version` |
| `kubectl` | 1.28+ | `kubectl version --client` |
| `kind` | 0.23+ | `kind --version` |
| `helm` | 3.x | `helm version` |
| `git` | any | `git --version` |

**Resource budget**: 8 GB+ RAM allocated to Docker Desktop is a safe starting point for the full stack (kind + ingress + Postgres + backend + frontend + kube-prometheus-stack + Jenkins). Stop Jenkins between pipeline runs when not needed — it's the heaviest idle consumer.

---

## Step 1 — Create the Kind Cluster

```powershell
cd C:\Users\Home\Desktop\project\PDE
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl cluster-info --context kind-pde-dev
```

---

## Step 2 — Start the Local Docker Registry

```powershell
# On Windows use Git Bash or WSL to run the .sh script,
# OR use the PowerShell equivalent below:

# PowerShell equivalent:
docker run -d --restart=always -p "127.0.0.1:5000:5000" --name kind-registry registry:2
docker network connect kind kind-registry
```

This starts a `registry:2` container on `localhost:5000` and wires it into the `kind` Docker network so cluster nodes can pull from it (via the containerd mirror in `kind-config.yaml`).

---

## Step 3 — Install ingress-nginx (kind-specific manifest)

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx `
    --for=condition=ready pod `
    --selector=app.kubernetes.io/component=controller `
    --timeout=120s
```

**Add local hostname** — append to `C:\Windows\System32\drivers\etc\hosts` (run Notepad as Administrator):
```
127.0.0.1  pde.local
```

---

## Step 4 — Seed the Local Registry (initial images)

`values-local.yaml` uses `tag: dev` — that tag must exist in the registry before ArgoCD's first sync.

**PowerShell:**
```powershell
$TAG = "dev"
docker build -t "localhost:5000/pde/backend:$TAG"  pde-backend
docker push "localhost:5000/pde/backend:$TAG"

docker build -f pde-frontend/Dockerfile.prod -t "localhost:5000/pde/frontend:$TAG" pde-frontend
docker push "localhost:5000/pde/frontend:$TAG"
```

---

## Step 5 — Configure Git Remote (ArgoCD needs this)

ArgoCD polls a real git repository. Options:

- **GitHub/GitLab (recommended for practice)**: push this repo to a repository you control, then update `repoURL` in `local-k8s/argocd/application.yaml` to your fork URL. Add ArgoCD repo credentials if the repo is private: `argocd repo add <url> --username <u> --password <token>`.
- **Fully offline — local Gitea**:
  ```bash
  docker run -d --name local-gitea -p 3001:3000 --network kind -v gitea-data:/data gitea/gitea:latest
  ```
  Create a repo at `http://localhost:3001`, push there, and set `repoURL` to `http://local-gitea.kind:3000/<user>/PDE.git`.

After choosing: update `repoURL` in **both** `local-k8s/argocd/application.yaml` and `GIT_REPO_URL` in `local-k8s/Jenkinsfile.k8s`, then commit and push.

---

## Step 6 — Install ArgoCD

```powershell
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
```

**Get the admin password** (PowerShell):
```powershell
$b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
```

**Start port-forward + open UI:**
```powershell
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/argocd-server -n argocd 8081:443" -WindowStyle Hidden
# UI: https://localhost:8081  (accept the self-signed cert warning)
# Login: admin / <password from above>
```

---

## Step 7 — Deploy the App via ArgoCD

```powershell
kubectl apply -f local-k8s/argocd/application.yaml
# Watch the sync (takes ~1-2 min on first run):
kubectl get application pde -n argocd -w
```

Once `Synced + Healthy`, visit **http://pde.local**. The backend seeds reference data automatically on first startup.

---

## Step 8 — Jenkins (CI — builds images, hands off to ArgoCD)

Jenkins runs as a **custom Docker container** (`jenkins-pde:latest`) with Docker CLI and Python 3.11 pre-installed. The stock `jenkins/jenkins:lts` image does not have Docker CLI — always use the custom image for this stack.

### 8a — Build the custom Jenkins image

Run from the **repo root**:

```powershell
docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .
```

This bakes in: Docker CLI, Python 3.11 + venv, Node.js + npm, and the required Jenkins plugins. It takes 2-3 minutes on first build (plugin downloads); subsequent builds are fast due to layer caching.

### 8b — Start Jenkins

**PowerShell (Docker Desktop for Windows):**
```powershell
docker run -d `
    --name jenkins `
    --network kind `
    --group-add 0 `
    -p 8080:8080 -p 50000:50000 `
    -v jenkins_home:/var/jenkins_home `
    -v //var/run/docker.sock://var/run/docker.sock `
    jenkins-pde:latest
```

> **`--network kind`**: lets Jenkins reach `localhost:5000` (the local registry) and `kind-registry:5000` from inside the container.
>
> **`--group-add 0`**: on Docker Desktop, the Docker socket (`/var/run/docker.sock`) is owned by root:root, so Jenkins needs group 0 access to use it.
>
> **`//var/run/docker.sock://var/run/docker.sock`**: double slashes are required in PowerShell/Git Bash on Windows for Docker volume path translation. On Linux/macOS use single slashes.

**Unlock Jenkins:**
```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Open http://localhost:8080, paste the password, install suggested plugins
```

### 8c — Configure Jenkins (UI steps — one time)

1. **Add git credential** (`Manage Jenkins → Credentials → System → Global credentials → Add Credentials`):
   - Kind: `Username with password`
   - Username: your GitHub username
   - Password: your GitHub Personal Access Token (needs `repo` scope)
   - ID: **`git-creds`** (must match exactly — this ID is referenced in `Jenkinsfile.k8s`)

2. **Create pipeline job** (`New Item → name: pde-local → Pipeline → OK`):
   - Pipeline definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: your repo URL
   - Credentials: `git-creds`
   - Branch: `*/main`
   - Script Path: `local-k8s/Jenkinsfile.k8s`
   - Save

### 8d — Run the pipeline

Click **Build Now** on the `pde-local` job. The pipeline:
1. Runs backend quality gate (ruff + pytest in a `python:3.11-slim` container)
2. Runs frontend quality gate (npm ci + build in the Jenkins agent)
3. Builds + pushes both images with tag `<BUILD_NUMBER>-<git-sha>`
4. Edits `helm/pde/values-local.yaml` — replaces both image tags
5. Commits and pushes the values change to your repo

ArgoCD polls the repo every ~3 minutes and rolls out new pods automatically.

---

## Step 9 — Prometheus + Grafana

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack `
    -n monitoring --create-namespace `
    -f monitoring/prometheus-values-local.yaml

kubectl apply -f monitoring/service-monitor.yaml
kubectl apply -f monitoring/alerting-rules.yaml
```

> The ServiceMonitor is **required** — it is now the only scrape mechanism for
> the backend (the old `additionalScrapeConfigs` job was removed from
> `prometheus-values-local.yaml`). Verify at http://localhost:9090 → Status →
> Targets: `pde-backend` should be `UP` after the backend pods are Running.

**Access:**
```powershell
# Run start-port-forwards.ps1 (starts Grafana + Prometheus + ArgoCD port-forwards)
powershell -File local-k8s\scripts\start-port-forwards.ps1
```

| UI | URL | Login |
|---|---|---|
| Grafana | http://localhost:3000 | `admin` / `pde-grafana-admin` |
| Prometheus | http://localhost:9090 | — |

In Prometheus → Status → Targets, confirm `pde-backend` shows **UP**. In Grafana, the **PDE** folder contains `pde-overview` and `pde-resources` dashboards.

---

## Step 10 — After a Reboot

```powershell
cd C:\Users\Home\Desktop\project\PDE
powershell -File local-k8s\scripts\restart-stack.ps1
powershell -File local-k8s\scripts\start-port-forwards.ps1
```

See `local-k8s/scripts/RECOVERY-CHECKPOINT.md` for per-component recovery steps.

---

## Verification Checklist

- [ ] `kubectl get pods -n pde` — postgres, backend, frontend all `Running`
- [ ] `http://pde.local` — DakhalNama login page loads
- [ ] Register + log in works (JWT + CSRF same-origin)
- [ ] `curl http://pde.local/api/health` → `{"status":"ok",...}`
- [ ] `curl http://pde.local/metrics` — 404 expected (metrics are on the backend pod directly, not via ingress)
- [ ] Prometheus target `pde-backend` shows `UP`
- [ ] Grafana → PDE folder → dashboards show live data
- [ ] Jenkins pipeline run succeeds → ArgoCD shows new sync → new pods rolled out

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| ArgoCD stuck `OutOfSync` or `Unknown` | Bad `repoURL` or missing repo credentials | `kubectl logs -n argocd deploy/argocd-repo-server` |
| Pods `ImagePullBackOff` | Tag `dev` (or bumped tag) not in registry | Push images: `docker push localhost:5000/pde/backend:dev` |
| `docker: command not found` in Jenkins | Using stock `jenkins/jenkins:lts` instead of `jenkins-pde:latest` | Rebuild + restart Jenkins with the custom image (§8a–b) |
| Git push fails in Jenkins (403) | Token missing `repo` scope, or ID mismatch | Verify `git-creds` ID and token scope in Jenkins credentials |
| Frontend loads but API calls fail (CORS) | Hitting backend directly, not via `http://pde.local/api/...` | Use the ingress path — nginx proxies `/api/*` to the backend |
| `/metrics` returns 404 | Backend image is stale — built before `requirements.txt`/`main.py` changes | Rebuild: `docker build -t localhost:5000/pde/backend:dev pde-backend && docker push ...` |
| Port-forward disconnects | Normal — port-forwards die after a while | Re-run `start-port-forwards.ps1` |
| `kubectl wait` timeout on node | Node IP changed after reboot, kubeconfig stale | `kind export kubeconfig --name pde-dev` |

---

## Teardown

```powershell
kind delete cluster --name pde-dev
docker rm -f kind-registry jenkins local-gitea 2>$null
docker volume rm jenkins_home gitea-data 2>$null
```
