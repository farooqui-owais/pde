# PDE Local K8s CI/CD — Recovery & Checkpoint Guide

If your system restarts or Docker crashes, use this guide to pick up where you left off **without starting from scratch**. Most components survive reboots — only Jenkins port-forwards need to be restarted manually.

---

## Quick Recovery (Single Command)

```powershell
cd C:\Users\Home\Desktop\project\PDE
powershell -File local-k8s\scripts\restart-stack.ps1
powershell -File local-k8s\scripts\start-port-forwards.ps1
```

This handles steps 1-4 below automatically. Only read further if something fails.

---

## Incident 2026-09-18: API server EOF / control-plane flapping after cold start

**Symptoms seen in `restart-stack.ps1` output:**
```
couldn't get current server API group list: Get "https://127.0.0.1:51035/api?timeout=32s": EOF
```
plus kube-controller-manager / kube-scheduler CrashLoopBackOff (60+ restarts),
kube-apiserver liveness failures (`statuscode: 500` on /livez), and transient
`pods is forbidden ... User "kubernetes-admin"` errors.

**Root cause (measured):** WSL2 disk I/O saturation during the stack cold-start.
`/proc/pressure/io` spiked to ~85-88% ("some"), etcd reads took 60-100s
(`'agreement among raft nodes before linearized reading' duration: 1m40s`),
so the API server timed out, controller-manager lost its leader-election lease
and crash-looped. Restart loops made it worse (each pod restart re-extracts
image layers). The transient "Forbidden" errors happen because k8s 1.33 kubeadm
grants admin via the `kubeadm:cluster-admins` RBAC group, which is only
reconciled once kube-controller-manager is back up.

**Remedies applied:**
1. Shed load while the storm passes:
   ```powershell
   kubectl scale deploy -n monitoring --all --replicas=0
   kubectl scale deploy -n argocd     --all --replicas=0
   # wait ~2 min, verify: docker exec pde-dev-control-plane head -1 /proc/pressure/io
   kubectl scale deploy -n monitoring --all --replicas=1
   kubectl scale deploy -n argocd     --all --replicas=1
   ```
   Note: ArgoCD self-heal will re-scale its own workloads back up while its
   controller is down, so scale argocd first / expect to re-run it.
2. Delete stale duplicate pods from pre-restart ReplicaSets (they persist
   while the controller-manager is down).
3. `restart-stack.ps1` now has a **control-plane health gate (section 5b)**
   that waits for the controller-manager and prints the load-shedding advice
   above instead of leaving you with silent EOF errors.

**Durable options (pick one):**
- Raise Docker Desktop resources beyond 8 CPU / 6 GB (Settings → Resources).
- Or run the stack without `monitoring` when doing local dev:
  `kubectl scale deploy -n monitoring --all --replicas=0`.
- Avoid rapid repeated `restart-stack.ps1` runs; each run re-rolls pods.

**Related transient failure:** `pde-frontend` nginx crash with
`host not found in resolver "kube-dns.kube-system.svc.cluster.local"` is NOT a
config error — nginx resolves its resolver hostname at startup and fails while
CoreDNS/etcd is unreachable. It self-recovers; no fix needed.

---

This handles steps 1-4 below automatically. Only read further if something fails.

---

## Quick Status Check

```powershell
# What's running?
docker ps

# Is the cluster alive?
kind get clusters
kubectl cluster-info
kubectl get nodes
kubectl get pods -n pde
kubectl get pods -n argocd
kubectl get pods -n monitoring
```

---

## What Survives a Reboot?

| Component | Survives? | Notes |
|---|---|---|
| Kind cluster `pde-dev` | ✓ Yes | Docker container auto-starts with Docker Desktop |
| `kind-registry` | ✓ Yes | Created with `--restart=always` |
| All k8s objects (PVCs, namespaces, deployments) | ✓ Yes | Stored in etcd inside the kind container |
| Docker images (`backend:dev`, `frontend:dev`) | ✓ Yes | On host Docker layer storage |
| Jenkins jobs + credentials | ✓ Yes | Stored in `jenkins_home` Docker volume |
| ArgoCD config + app state | ✓ Yes | Stored in cluster etcd |
| Port-forwards | ✗ No | Always restart manually after reboot |
| Jenkins container | ✗ No | No `--restart` policy — start manually |

---

## Recovery by Component

### Phase 1 — Tools (always survive)

```powershell
docker --version
kubectl version --client
kind --version
helm version
git --version
```

---

### Phase 2 — Kind Cluster

**Check:**
```powershell
kubectl get nodes
# Expected: pde-dev-control-plane   Ready
```

**If cluster is gone (rare — only if Docker was wiped):**
```powershell
cd C:\Users\Home\Desktop\project\PDE
kind delete cluster --name pde-dev   # clean up any partial state
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s
```

**If `kubectl` can't connect (kubeconfig stale after IP change):**
```powershell
kind export kubeconfig --name pde-dev
kubectl cluster-info
```

**If the node is `NotReady` / `NodeStatusUnknown` (kind node IP drift):**

Symptom — after a Docker Desktop restart, `restart-stack.ps1` stops at the
`kubectl wait` step with:

```
E0918 18:02:18 ... memcache.go:265 "Unhandled Error" err="couldn't get current
server API group list: Get "https://127.0.0.1:51035/api?timeout=32s": EOF"
```

Cause — Docker Desktop's own Kubernetes cluster (`desktop-control-plane`) and the
`pde-dev` node share the docker bridge network named `kind`, so whichever starts
first gets `172.18.0.2`. When Docker Desktop wins, `pde-dev` moves to
`172.18.0.3`. kind's node entrypoint rewrites the apiserver certificate and
`scheduler.conf` / `controller-manager.conf` for the new address, but it does
**not** rewrite `/etc/kubernetes/kubelet.conf`. kubelet therefore dials the old
address — which is now the *other* cluster's API server:

```
docker exec pde-dev-control-plane journalctl -u kubelet -n 30 --no-pager
# x509: certificate signed by unknown authority ... certificate "kubernetes"
```

Check and fix (also automated as step 2c of `restart-stack.ps1`):
```powershell
# what the node really has vs. what kubelet.conf says
docker inspect -f '{{(index .NetworkSettings.Networks "kind").IPAddress}}' pde-dev-control-plane
docker exec pde-dev-control-plane grep server: /etc/kubernetes/kubelet.conf

# repoint kubelet at the node's own address (substitute your IPs)
docker exec pde-dev-control-plane sed -i s#https://172.18.0.2:6443#https://172.18.0.3:6443# /etc/kubernetes/kubelet.conf
docker exec pde-dev-control-plane systemctl restart kubelet

kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=180s
```

> The host `kubectl` keeps working (it uses `127.0.0.1:<port>` from
> `~/.kube/config`), so `kubectl get nodes` may even succeed while the node is
> `NotReady`. Judge health by the node condition, not by the client's ability to
> connect.

---

### Phase 3 — Local Registry

**Check:**
```powershell
docker ps | Select-String "kind-registry"
curl http://localhost:5000/v2/_catalog
# Expected: {"repositories":["pde/backend","pde/frontend"]}
```

**If registry is stopped:**
```powershell
docker start kind-registry
```

**If registry container is gone:**
```powershell
docker run -d --restart=always -p "127.0.0.1:5000:5000" --name kind-registry registry:2
docker network connect kind kind-registry
```

**If images are missing from the registry (volume was wiped):**
```powershell
cd C:\Users\Home\Desktop\project\PDE
$TAG = "dev"
docker build -t "localhost:5000/pde/backend:$TAG"  pde-backend
docker push "localhost:5000/pde/backend:$TAG"
docker build -f pde-frontend/Dockerfile.prod -t "localhost:5000/pde/frontend:$TAG" pde-frontend
docker push "localhost:5000/pde/frontend:$TAG"
```

---

### Phase 4 — Ingress-nginx

**Check:**
```powershell
kubectl get pods -n ingress-nginx
# Expected: ingress-nginx-controller-* Running
ping pde.local   # Expected: 127.0.0.1
```

**If missing:**
```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx `
    --for=condition=ready pod `
    --selector=app.kubernetes.io/component=controller `
    --timeout=120s
```

---

### Phase 5 — App Images in Registry

**Check:**
```powershell
curl http://localhost:5000/v2/_catalog
# Expected: {"repositories":["pde/backend","pde/frontend"]}
```

**If missing — rebuild and push:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
$TAG = "dev"
docker build -t "localhost:5000/pde/backend:$TAG"  pde-backend
docker push "localhost:5000/pde/backend:$TAG"
docker build -f pde-frontend/Dockerfile.prod -t "localhost:5000/pde/frontend:$TAG" pde-frontend
docker push "localhost:5000/pde/frontend:$TAG"
```

---

### Phase 6 — Git Remote

**Check:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
git remote -v
git log --oneline -3
```

**If there are uncommitted changes:**
```powershell
git add .
git commit -m "recovery: restore state after restart"
git push
```

---

### Phase 7 — ArgoCD

**Check:**
```powershell
kubectl get pods -n argocd
# Expected: argocd-server-*, argocd-repo-server-*, etc. all Running
```

**If ArgoCD namespace is gone:**
```powershell
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
kubectl apply -f local-k8s/argocd/application.yaml
```

**Start port-forward and get admin password:**
```powershell
Start-Process -FilePath "cmd" `
    -ArgumentList "/c kubectl port-forward svc/argocd-server -n argocd 8081:443" `
    -WindowStyle Hidden

# Retrieve password (never stored in scripts):
$b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
# UI: https://localhost:8081  (admin / <password above>)
```

**Re-apply the PDE Application if it disappeared:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
kubectl apply -f local-k8s/argocd/application.yaml
kubectl get application pde -n argocd -w
# Wait for: Synced + Healthy
```

---

### Phase 8 — Jenkins

> **Critical**: Always use the **`jenkins-pde:latest`** custom image — not `jenkins/jenkins:lts`. The custom image has Docker CLI, Python 3.11, and Node.js pre-installed. The stock image lacks Docker CLI and the pipeline will fail on the first build step.

**Check:**
```powershell
docker ps | Select-String "jenkins"
docker inspect jenkins --format "{{.Config.Image}}"
# Expected: jenkins-pde:latest
```

**If Jenkins container is stopped (normal after reboot):**
```powershell
docker start jenkins
# UI available at http://localhost:8080
```

**If Jenkins container is gone:**

Step 1 — Build the custom image (from repo root, one-time or after Dockerfile changes):
```powershell
cd C:\Users\Home\Desktop\project\PDE
docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .
```

Step 2 — Start Jenkins with Docker socket mounted (PowerShell / Docker Desktop):
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

> **`//var/run/docker.sock://var/run/docker.sock`** — double slashes required in PowerShell/Git Bash on Windows (Docker Desktop). Use single slashes on Linux/macOS.

Step 3 — Unlock (only needed if `jenkins_home` volume was wiped):
```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Open http://localhost:8080, paste password, install suggested plugins
```

Step 4 — Recreate credentials and pipeline job (only if `jenkins_home` was wiped):
- See **PHASE8-JENKINS-MANUAL-SETUP.md** Steps 2–3.

**Verify Docker works inside Jenkins:**
```powershell
docker exec jenkins docker ps
# Expected: list of host containers (not an error)
```

---

### Phase 9 — Prometheus & Grafana

**Check:**
```powershell
kubectl get pods -n monitoring
# Expected: alertmanager-*, grafana-*, prometheus-*, node-exporter-* all Running
```

**If monitoring namespace is gone:**
```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack `
    -n monitoring --create-namespace `
    -f C:\Users\Home\Desktop\project\PDE\monitoring\prometheus-values-local.yaml

kubectl apply -f C:\Users\Home\Desktop\project\PDE\monitoring\service-monitor.yaml
kubectl apply -f C:\Users\Home\Desktop\project\PDE\monitoring\alerting-rules.yaml
```

> **`service-monitor.yaml` is required, not optional.** It is now the ONLY scrape
> mechanism for the backend (the old `additionalScrapeConfigs` job was removed
> from `prometheus-values-local.yaml`). Skip it and Prometheus shows zero
> targets — `up{job="pde-backend"}` never becomes 1. Verify at
> http://localhost:9090 → Status → Targets: `pde-backend` should be `UP`.

**Access Grafana + Prometheus (after running start-port-forwards.ps1):**
```
Grafana    : http://localhost:3000  (admin / pde-grafana-admin)
Prometheus : http://localhost:9090
```

---

## Complete Nuke & Rebuild

Only needed if everything is broken beyond recovery (takes ~10 minutes):

```powershell
cd C:\Users\Home\Desktop\project\PDE

# Clean everything
kind delete cluster --name pde-dev
docker rm -f kind-registry jenkins
docker volume rm jenkins_home
# (do NOT prune the docker build cache — it makes rebuilds much faster)

# Rebuild cluster + registry
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
docker run -d --restart=always -p "127.0.0.1:5000:5000" --name kind-registry registry:2
docker network connect kind kind-registry

# Build Jenkins image
docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .

# Seed registry with initial images
$TAG = "dev"
docker build -t "localhost:5000/pde/backend:$TAG"  pde-backend
docker push "localhost:5000/pde/backend:$TAG"
docker build -f pde-frontend/Dockerfile.prod -t "localhost:5000/pde/frontend:$TAG" pde-frontend
docker push "localhost:5000/pde/frontend:$TAG"

# Then follow local-k8s/README.md Steps 3-9
```

---

## Before System Shutdown (Save State)

```powershell
cd C:\Users\Home\Desktop\project\PDE
git add .
git commit -m "checkpoint: $(Get-Date -Format 'yyyy-MM-dd HH:mm') before shutdown"
git push
```
