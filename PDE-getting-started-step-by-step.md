# PDE Local CI/CD — Zero to Running: A Beginner-Friendly Walkthrough

This assumes you've never touched kind/ArgoCD/Jenkins before. Every step has:
**what you're doing → why → the exact command → what "it worked" looks like.**
Do them in order — each phase depends on the one before it.

**Confidence note:** commands are correct as of my last training data (Jan
2026 cutoff). Tool versions (kind, ArgoCD, ingress-nginx, Jenkins) move fast —
if a command errors out with something like "unknown flag" or a 404 on a
manifest URL, that's almost always a version drift, not a typo. Check the
tool's own docs (linked at each step) before assuming the command is wrong.

---

## Phase 0 — Install the tools (one-time)

You need 5 things on your machine. Install whichever you're missing:

| Tool | Check if installed | Install from |
|---|---|---|
| Docker Desktop | `docker --version` | https://www.docker.com/products/docker-desktop/ |
| kubectl | `kubectl version --client` | https://kubernetes.io/docs/tasks/tools/ |
| kind | `kind --version` | https://kind.sigs.k8s.io/docs/user/quick-start/#installation |
| Helm | `helm version` | https://helm.sh/docs/intro/install/ |
| git | `git --version` | https://git-scm.com/downloads |

**Checkpoint:** run all 5 version commands. If each prints a version number
(not "command not found"), you're ready for Phase 1.

**Docker memory:** open Docker Desktop → Settings → Resources → give it at
least 6-8GB RAM. Everything in this stack runs as containers, so Docker's
memory limit is the real ceiling.

---

## Phase 1 — Unzip and look around

```bash
unzip PDE-local-k8s-cicd.zip -d ~/pde-project
cd ~/pde-project/PDE
```

You should see folders like `pde-backend/`, `pde-frontend/`, `helm/`, `k8s/`,
`monitoring/`, and the new `local-k8s/` folder. All commands below assume
you're sitting inside this `PDE` folder.

---

## Phase 2 — Create the Kubernetes cluster

**What:** kind runs a whole Kubernetes cluster inside a single Docker
container on your laptop — no cloud VM involved.

```bash
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
```

This takes 1-3 minutes the first time (it downloads a node image).

**Checkpoint:**
```bash
kubectl cluster-info --context kind-pde-dev
kubectl get nodes
```
You should see one node named `pde-dev-control-plane` with status `Ready`.

---

## Phase 3 — Start the local image registry

**What:** normally `docker push` sends images to Docker Hub or a cloud
registry (ECR, GCR). Since you want zero cloud, this step runs a tiny
registry server as a container on your own machine instead.

```bash
bash local-k8s/scripts/setup-local-registry.sh
```

**Checkpoint:** `docker ps` should show a container named `kind-registry`
running and mapped to port 5000.

---

## Phase 4 — Install ingress-nginx (so a browser can reach the app)

**What:** right now the cluster has no way to receive traffic from your
browser. ingress-nginx is the "front door" — it listens on port 80 and routes
requests to the right service inside the cluster.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

The `wait` command will just sit there until the ingress controller pod is
ready, then print `pod/... condition met`. If it times out, run
`kubectl get pods -n ingress-nginx` to see what state it's stuck in.

**Then**, tell your computer that `pde.local` means "my own machine". Add
this line to your hosts file:

- Mac/Linux: `sudo nano /etc/hosts`
- Windows: open Notepad **as Administrator**, then open
  `C:\Windows\System32\drivers\etc\hosts`

Add:
```
127.0.0.1 pde.local
```
Save and close.

**Checkpoint:** `ping pde.local` should reply from `127.0.0.1`.

---

## Phase 5 — Build the app images and push them once, manually

**What:** before ArgoCD can deploy anything, at least one version of the
backend and frontend images has to already exist in the registry from Phase
3. This is the only manual build you'll do — after this, Jenkins does it.

```bash
bash local-k8s/scripts/build-and-push-local.sh dev
```

This builds `pde-backend` and `pde-frontend` (using the new
`Dockerfile.prod`), and pushes both to `localhost:5000` tagged `dev`.

**Checkpoint:** you should see two `Pushed:` lines at the end mentioning
`localhost:5000/pde/backend:dev` and `localhost:5000/pde/frontend:dev`. First
build takes a few minutes (downloading base images); it's much faster after.

---

## Phase 6 — Put the project in a git repo (ArgoCD needs this)

**What:** ArgoCD's whole job is "watch a git repo, keep the cluster matching
what's in it." It cannot deploy from a folder on your laptop — it needs an
actual git remote to poll.

**Simplest path — GitHub:**
1. Create a new (private is fine) repo on https://github.com/new
2. Push this project to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: PDE with local k8s CI/CD setup"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

**Fully offline alternative:** see `local-k8s/README.md` §6 for running a
local Gitea git server instead — skip this if GitHub is fine for you (it's
your own private repo either way, not the app talking to any cloud service).

**Now edit two placeholder lines** to point at the repo you just created:
- `local-k8s/argocd/application.yaml` → `repoURL:` field
- `local-k8s/Jenkinsfile.k8s` → `GIT_REPO_URL` line

Commit and push that edit too:
```bash
git add local-k8s/argocd/application.yaml local-k8s/Jenkinsfile.k8s
git commit -m "Point ArgoCD and Jenkins at this repo"
git push
```

---

## Phase 7 — Install ArgoCD and deploy the app

**What:** ArgoCD is the tool that actually creates your app's pods, services,
etc. in the cluster, by reading the Helm chart in your git repo.

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
```

Open the ArgoCD UI (leave this running in its own terminal tab):
```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```
Visit **https://localhost:8081** (your browser will warn about the
certificate — that's expected for a local self-signed cert, click through).

Get the admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```
Log in with username `admin` and that password.

**Now deploy the actual app:**
```bash
kubectl apply -f local-k8s/argocd/application.yaml
```

**Checkpoint:** in the ArgoCD UI you should see a tile named `pde`. Click it
— within a minute or two it should turn **green (Healthy)** and **blue/green
(Synced)**. If it stays grey/red, see the Troubleshooting section at the end.

Once it's green:
```bash
kubectl get pods -n pde
```
You should see `postgres-...`, `pde-backend-...`, and `pde-frontend-...` pods,
all `Running`.

**Visit http://pde.local** — you should see the DakhalNama login page.
Register an account, log in, poke around. Reference dropdowns (districts,
article types) populate automatically — no manual seed step needed.

---

## Phase 8 — Install Jenkins and run your first pipeline

**What:** this is the "CI" half — Jenkins rebuilds images whenever code
changes and hands the new tag off to ArgoCD.

```bash
docker run -d --name jenkins --network kind \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts
```
if error 
```bash 
docker run -d --name jenkins --network kind \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v //var/run/docker.sock://var/run/docker.sock \
  jenkins/jenkins:lts
```
Get the unlock password:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Visit **http://localhost:8080**, paste that password, choose "Install
suggested plugins", create your admin user.

**Give Jenkins a Docker CLI** (the base image doesn't ship one):
```bash
docker exec -u root jenkins sh -c "apt-get update && apt-get install -y docker.io"
```
(This is a local-only shortcut — a real setup would use a Jenkins agent image
that already has Docker built in.)

**Add your git credentials:** Manage Jenkins → Credentials → System → Global
credentials → Add Credentials. Kind: "Username with password" (a GitHub
Personal Access Token works as the password). ID: `git-creds` (must match
`Jenkinsfile.k8s`).

**Create the pipeline job:** New Item → name it `pde-local` → Pipeline type →
under Pipeline, choose "Pipeline script from SCM" → SCM: Git → paste your
repo URL + credentials → Script Path: `local-k8s/Jenkinsfile.k8s` → Save.

**Run it:** click "Build Now". Watch the stage view — it runs backend tests,
frontend build, builds+pushes both images, then bumps the image tag in
`values-local.yaml` and pushes that commit back to git.

**Checkpoint — the full loop:** after the pipeline finishes, go back to the
ArgoCD UI. Within ~3 minutes it should show a new sync (or force it instantly
via the "Refresh" button in the UI). `kubectl get pods -n pde` should show
new pods with a fresh `AGE`. That round-trip — code → Jenkins builds → ArgoCD
deploys — is the whole CI/CD loop working.

---

## Phase 9 — Install Prometheus and Grafana

**What:** now that the app is running, add monitoring so you can see request
rates, latency, and errors.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values-local.yaml

kubectl apply -f monitoring/alerting-rules.yaml
bash local-k8s/scripts/load-grafana-dashboards.sh
```

This installs slower than the earlier steps — give it 2-3 minutes, then:
```bash
kubectl get pods -n monitoring
```
Wait until everything shows `Running`.

**Open Grafana:**
```bash
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
```
Visit **http://localhost:3000** — login `admin` / `pde-grafana-admin`. Look
in the **PDE** folder for the two dashboards.

**Open Prometheus** (optional, to double check scraping):
```bash
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
```
Visit **http://localhost:9090** → Status → Targets → `pde-backend` should
show state `UP`.

---

## You're done — full checklist

- [ ] `kubectl get pods -n pde` — all `Running`
- [ ] http://pde.local loads and login/register works
- [ ] ArgoCD UI shows `pde` app as `Synced` + `Healthy`
- [ ] Jenkins pipeline runs green, producing a new commit
- [ ] That commit shows up as a new sync in ArgoCD within a few minutes
- [ ] Grafana shows the PDE dashboards with live data
- [ ] Prometheus target `pde-backend` is `UP`

## Common early mistakes

- **Skipping Phase 5** — ArgoCD will fail to deploy if `dev` tag images
  don't exist in the registry yet.
- **Forgetting the `/etc/hosts` line** — http://pde.local won't resolve.
- **Editing `kind-config.yaml` after the cluster already exists** — kind only
  reads that file at `kind create cluster` time. Delete and recreate the
  cluster if you change it.
- **Leaving `repoURL`/`GIT_REPO_URL` as the placeholder text** — ArgoCD and
  Jenkins will both fail with a clear "repo not found"-style error until you
  fix these.

## Full reference

`local-k8s/README.md` (inside the zip) has the same steps in a denser,
reference-style format plus a troubleshooting section — come back to that
once you're comfortable and just need a quick command lookup.
