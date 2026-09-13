# PDE (DakhalNama) — Local Kubernetes + CI/CD Practice Setup

Full local stack for the PDE project: **kind** (Kubernetes) + a **local Docker
registry** + **ingress-nginx** + **Jenkins** (CI) + **ArgoCD** (GitOps CD) +
**Prometheus/Grafana** (observability). Zero cloud accounts required.

**Confidence note (per your standing preference):** this setup is built from
the actual files in your PDE.zip — the Helm chart, Dockerfiles, k8s manifests,
and monitoring configs I reference below are things I read directly from your
project, not assumed. Version numbers for external tools (kind, Helm charts,
ArgoCD, ingress-nginx) reflect my last known-good versions as of my knowledge
cutoff (Jan 2026) — I've flagged the specific ones worth double-checking
against upstream docs before you install, since these projects release
frequently.

---

## 0. What I changed in your project, and why

| File | Change | Why |
|---|---|---|
| `pde-backend/requirements.txt` | added `prometheus-fastapi-instrumentator==7.0.0` | your `monitoring/prometheus-values.yaml` already had a scrape job for `pde-backend` `/metrics`, but the backend never exposed that endpoint — verify this version against PyPI before pinning it long-term |
| `pde-backend/app/main.py` | added `Instrumentator().instrument(app).expose(app, endpoint="/metrics", ...)` | actually exposes `/metrics`, GET-only so it passes your CSRF middleware unchanged |
| `pde-frontend/src/api/axios.js` | `\|\|` → `??` for the `VITE_API_BASE_URL` fallback | lets the prod image ship an intentionally **empty** base URL (same-origin requests through nginx's `/api` proxy) without falling back to `localhost:8000` |
| `pde-frontend/Dockerfile.prod` | **new file** | your `helm/pde/templates/frontend-deployment.yaml` already expected port 80 + `/nginx-health` (i.e. an nginx-served static build), but the existing `pde-frontend/Dockerfile` runs the Vite **dev server** on port 5173. That mismatch meant the Helm chart's frontend deployment would never actually have worked as written. `Dockerfile.prod` is a multi-stage build (`vite build` → serve via your existing `nginx.conf`) that matches what the chart expects. Your original `Dockerfile` and `docker-compose.yml` workflow are untouched. |
| `helm/pde/values-local.yaml` | **new file** | kind/local-registry/ingress-nginx overrides (your existing `values-dev.yaml` targets Docker Desktop's built-in k8s, which shares its daemon with `docker build` — kind is a separate Docker container and needs a registry instead) |
| `monitoring/prometheus-values-local.yaml` | **new file** | laptop-sized version of your EKS-oriented `prometheus-values.yaml` (smaller storage, no SMTP dependency) |
| `local-k8s/**` | **new directory** | everything below: kind config, registry/dashboard scripts, the k8s-targeted Jenkinsfile, and the ArgoCD Application manifest |

Nothing in `on-premise/`, `aws/`, `deploy/`, or your original `k8s/*.yaml` was
touched — those remain valid for their original (systemd / EKS / Docker
Desktop) targets.

---

## 1. Prerequisites

- Docker Desktop (or Docker Engine) running
- `kubectl`
- `kind` — I believe v0.23+ is a safe baseline, but check `kind --version` against https://kind.sigs.k8s.io/ for the current release
- `helm` v3
- `git`, plus a git remote you can push to (see §6 if you want this fully offline)

Rough resource budget for kind + ingress-nginx + Postgres + backend + frontend
+ kube-prometheus-stack + Jenkins container all running at once: **8GB+ RAM**
allocated to Docker is a reasonable starting point on a laptop. If things feel
sluggish, stop the Jenkins container between pipeline runs — it doesn't need
to run continuously.

---

## 2. Create the kind cluster

```bash
cd PDE   # repo root
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl cluster-info --context kind-pde-dev
```

## 3. Local registry (no cloud registry involved)

```bash
bash local-k8s/scripts/setup-local-registry.sh
```

This starts a `registry:2` container on `localhost:5000` and wires it into
the `kind` Docker network so cluster nodes can pull from it too (see the
comments in `local-k8s/kind-config.yaml` for how the containerd mirror is
configured).

## 4. Install ingress-nginx (kind-specific manifest)

kind ships a provider-specific ingress-nginx manifest that matches the
`ingress-ready=true` node label set in `kind-config.yaml`:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

Then map a local hostname to it — add this line to `/etc/hosts`
(`C:\Windows\System32\drivers\etc\hosts` on Windows):
```
127.0.0.1 pde.local
```

## 5. Seed the local registry with an initial image (before ArgoCD's first sync)

`values-local.yaml` is set to `pullPolicy: Always` with `tag: dev` — that tag
has to exist in the registry before anything can deploy successfully:

```bash
bash local-k8s/scripts/build-and-push-local.sh dev
```

## 6. Get a git remote ArgoCD can watch

ArgoCD needs to poll an actual git repository — pick ONE:

- **Simplest — GitHub/GitLab:** push this repo (with all the changes above)
  to a repo you control, private is fine. Add ArgoCD repo credentials if
  private: `argocd repo add <url> --username <u> --password <token>` (via the
  ArgoCD CLI, once installed).
- **Fully offline — local Gitea:** run a one-container git server so nothing
  leaves your machine:
  ```bash
  docker run -d --name local-gitea -p 3001:3000 -p 2222:22 \
    --network kind -v gitea-data:/data gitea/gitea:latest
  ```
  Then create a repo via `http://localhost:3001`, push this project to it,
  and use `http://local-gitea.kind:3000/<user>/PDE.git` (or the container's
  IP on the `kind` network) as the ArgoCD `repoURL` — I haven't verified the
  exact in-cluster DNS name Gitea's default config expects, so check its
  `app.ini` `ROOT_URL` setting if cloning fails from inside the cluster.

Once you've picked one, edit the `repoURL` placeholder in
`local-k8s/argocd/application.yaml` and the `GIT_REPO_URL` placeholder in
`local-k8s/Jenkinsfile.k8s`, then commit and push this whole project.

## 7. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server

kubectl port-forward svc/argocd-server -n argocd 8081:443 &
```
- UI: https://localhost:8081 (self-signed cert — accept the browser warning)
- Username: `admin`
- Password: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d`

## 8. Deploy the app via ArgoCD

```bash
kubectl apply -f local-k8s/argocd/application.yaml
```
Watch it sync:
```bash
kubectl get application pde -n argocd -w
```
Once `Synced`/`Healthy`, visit **http://pde.local**. Register a user, log in
— reference data (districts/offices/article types) seeds itself
automatically on backend startup.

## 9. Jenkins (CI, builds new images, hands off to ArgoCD)

Run Jenkins as a standalone container with the Docker socket mounted so it
can build/push images, and with git credentials configured for push access:

```bash
docker run -d --name jenkins --network kind \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts
```
- UI: http://localhost:8080 (unlock with the password in
  `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`)
- Install the suggested plugins, then **Git** + **Docker Pipeline** plugins if
  not already included.
- Add a credential `git-creds` (Manage Jenkins → Credentials) with push
  access to the repo from §6.
- Docker CLI isn't in the base Jenkins image — either use a Jenkins agent
  image with Docker installed, or `docker exec -u root jenkins sh -c "apt-get
  update && apt-get install -y docker.io"` as a quick local-only workaround.
- Create a **Pipeline** job pointing at your repo, script path
  `local-k8s/Jenkinsfile.k8s`.

Running the pipeline: quality gates → build+push both images with a
`${BUILD_NUMBER}-<shortsha>` tag → bump `values-local.yaml`'s two `tag:`
lines → commit + push. ArgoCD picks up that commit (poll interval ~3 min by
default) and rolls the new images out — that handoff is the actual CI→CD
boundary in this setup.

## 10. Prometheus + Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values-local.yaml

kubectl apply -f monitoring/alerting-rules.yaml
bash local-k8s/scripts/load-grafana-dashboards.sh
```

Access:
```bash
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80 &
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090 &
```
- Grafana: http://localhost:3000 — `admin` / `pde-grafana-admin` (from
  `prometheus-values-local.yaml`) — your two dashboards should already be in
  the **PDE** folder.
- Prometheus: http://localhost:9090 → Status → Targets → confirm
  `pde-backend` is `UP`.

---

## 11. Verification checklist

- [ ] `kubectl get pods -n pde` — postgres, backend, frontend all `Running`
- [ ] http://pde.local loads the DakhalNama login page
- [ ] Register + log in works end-to-end (JWT + CSRF cookie both same-origin now)
- [ ] `curl http://pde.local/api/health` → `{"status":"ok",...}`
- [ ] Prometheus target `pde-backend` shows `UP`
- [ ] Grafana **PDE** folder shows `pde-overview` and `pde-resources` dashboards with live data
- [ ] A Jenkins pipeline run produces a new image tag, and `kubectl get application pde -n argocd` shows a new sync shortly after

## 12. Troubleshooting

- **ArgoCD stuck `OutOfSync`/`Unknown`:** usually a bad `repoURL` or missing
  repo credentials — `kubectl logs -n argocd deploy/argocd-repo-server`.
- **Pods stuck `ImagePullBackOff`:** the `dev` (or bumped) tag likely isn't in
  the registry yet, or the containerd mirror in `kind-config.yaml` didn't
  apply — recreate the cluster if you edited that file after cluster creation
  (kind only reads it at creation time).
- **Frontend loads but API calls fail with CORS errors:** you're probably
  hitting the backend directly on a different port instead of through
  `http://pde.local/api/...` — the whole point of the nginx proxy + ingress
  path routing is to avoid that.
- **`/metrics` returns 404:** the backend image is stale — rebuild after the
  `requirements.txt`/`main.py` changes above.

## 13. Teardown

```bash
kind delete cluster --name pde-dev
docker rm -f kind-registry jenkins local-gitea 2>/dev/null || true
docker volume rm jenkins_home gitea-data 2>/dev/null || true
```
