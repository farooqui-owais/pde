# PDE Local K8s CI/CD — Recovery & Checkpoint Guide

If your system restarts or Docker crashes, use this guide to pick up where you left off **without starting from scratch**.

---

## Quick Status Check

Run this to see what's still running:

```powershell
# Check Docker containers
docker ps

# Check kind clusters
kind get clusters

# Check kubectl access
kubectl cluster-info
kubectl get nodes
```

---

## Recovery by Phase

### **Phase 0-1: Tools & Project Structure**
✓ **Always survive restarts** — files don't move, just re-check versions:
```powershell
docker --version
kubectl version --client
kind --version
helm version
git --version
```

---

### **Phase 2: Kind Cluster**

**If cluster is still running:**
```powershell
kubectl get nodes
# Expected: pde-dev-control-plane with status Ready
```

**If cluster crashed, recreate it:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
kind delete cluster --name pde-dev
Start-Sleep -Seconds 5
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s
```

---

### **Phase 3: Local Registry**

**Check if registry is running:**
```powershell
docker ps | Select-String "kind-registry"
```

**If it's gone, recreate it:**
```powershell
# 1. Create container
docker run -d --restart=always -p "127.0.0.1:5000:5000" --network bridge --name kind-registry registry:2

# 2. Connect to kind network
docker network connect kind kind-registry

# 3. Create ConfigMap in cluster
$configmap = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:5000"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
"@
$configmap | kubectl apply -f -
```

---

### **Phase 4: Ingress-Nginx**

**Check if it's running:**
```powershell
kubectl get pods -n ingress-nginx
# Expected: ingress-nginx-controller-* pod in Running state
```

**If missing, reinstall:**
```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

**Verify DNS:**
```powershell
ping pde.local
# Expected: 127.0.0.1
```

---

### **Phase 5: App Images in Registry**

**Check if images exist:**
```powershell
# List local registry images
curl http://localhost:5000/v2/_catalog

# Expected output:
# {"repositories":["pde/backend","pde/frontend"]}
```

**If images are missing, rebuild & push:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
$REGISTRY = "localhost:5000"
$TAG = "dev"

# Backend
docker build -t "${REGISTRY}/pde/backend:${TAG}" pde-backend
docker push "${REGISTRY}/pde/backend:${TAG}"

# Frontend
docker build -f pde-frontend/Dockerfile.prod -t "${REGISTRY}/pde/frontend:${TAG}" pde-frontend
docker push "${REGISTRY}/pde/frontend:${TAG}"
```

---

### **Phase 6: Git Repo**

**Check remote:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
git remote -v
git log --oneline -3
```

**If changes weren't pushed:**
```powershell
git add .
git commit -m "recovery: restore state after restart"
git push
```

---

### **Phase 7: ArgoCD**

**Check if ArgoCD namespace exists:**
```powershell
kubectl get pods -n argocd
```

**If missing, reinstall:**
```powershell
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
```

**Restart port-forward to ArgoCD UI:**
```powershell
# Kill old port-forward if it exists (check Task Manager)
# Then run:
kubectl port-forward svc/argocd-server -n argocd 8081:443
# (Leave this terminal open; UI is at https://localhost:8081)
```

**Get admin password again:**
```powershell
$pwd = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($pwd))
```

**Deploy the PDE Application:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
kubectl apply -f local-k8s/argocd/application.yaml

# Wait for it to sync (check ArgoCD UI at https://localhost:8081)
# Expected: pde app tile shows Synced + Healthy (green)
```

**Verify app is running:**
```powershell
kubectl get pods -n pde
# Expected: postgres-*, pde-backend-*, pde-frontend-* all Running
```

---

### **Phase 8: Jenkins**

**Check if Jenkins container exists:**
```powershell
docker ps | Select-String "jenkins"
```

**If missing, create it:**
```powershell
docker run -d --name jenkins --network kind `
  -p 8080:8080 -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v //var/run/docker.sock://var/run/docker.sock `
  jenkins/jenkins:lts

# Get unlock password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword

# Visit http://localhost:8080, paste password, install suggested plugins
```

**Give Jenkins Docker CLI:**
```powershell
docker exec -u root jenkins sh -c "apt-get update && apt-get install -y docker.io"
```

**Add git credentials (in Jenkins UI):**
- Go to Manage Jenkins → Credentials → System → Global credentials
- Add Credentials → Kind: "Username with password"
- Username: your GitHub username
- Password: GitHub Personal Access Token
- ID: `git-creds`

**Create pipeline job (in Jenkins UI):**
- New Item → name: `pde-local` → Pipeline
- Pipeline → "Pipeline script from SCM"
- SCM: Git → Repo URL: `https://github.com/farooqui-owais/pde.git`
- Credentials: `git-creds`
- Script Path: `local-k8s/Jenkinsfile.k8s`
- Save → Build Now

---

### **Phase 9: Prometheus & Grafana**

**Check if monitoring namespace exists:**
```powershell
kubectl get pods -n monitoring
```

**If missing, install:**
```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack `
  -n monitoring --create-namespace `
  -f C:\Users\Home\Desktop\project\PDE\monitoring\prometheus-values-local.yaml

kubectl apply -f C:\Users\Home\Desktop\project\PDE\monitoring\alerting-rules.yaml

# Note: load-grafana-dashboards.sh uses bash; on Windows, manually add dashboards via Grafana UI
```

**Access Grafana:**
```powershell
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
# Visit http://localhost:3000
# Login: admin / pde-grafana-admin
```

---

## Full Restart Automation

Create a **batch restart script** that brings everything up in order:

Save as `restart-all.ps1`:
```powershell
$ErrorActionPreference = "Stop"

Write-Host "=== PDE Stack Recovery ===" -ForegroundColor Cyan

# Phase 2: Cluster
Write-Host "1. Checking kind cluster..." -ForegroundColor Yellow
$clusters = kind get clusters
if (-not $clusters -or $clusters -notcontains "pde-dev") {
    Write-Host "   Cluster missing, creating..." -ForegroundColor Yellow
    kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
}
kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s

# Phase 3: Registry
Write-Host "2. Checking local registry..." -ForegroundColor Yellow
$registry = docker ps | Select-String "kind-registry"
if (-not $registry) {
    Write-Host "   Registry missing, creating..." -ForegroundColor Yellow
    docker run -d --restart=always -p "127.0.0.1:5000:5000" --network bridge --name kind-registry registry:2
    docker network connect kind kind-registry
}

# Phase 4: Ingress
Write-Host "3. Checking ingress-nginx..." -ForegroundColor Yellow
$ingress = kubectl get deployment -n ingress-nginx 2>$null
if (-not $ingress) {
    Write-Host "   Ingress missing, installing..." -ForegroundColor Yellow
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
}

# Phase 7: ArgoCD
Write-Host "4. Checking ArgoCD..." -ForegroundColor Yellow
$argocd = kubectl get deployment -n argocd 2>$null
if (-not $argocd) {
    Write-Host "   ArgoCD missing, installing..." -ForegroundColor Yellow
    kubectl create namespace argocd
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
}

# Apply PDE Application
Write-Host "5. Applying PDE Application..." -ForegroundColor Yellow
kubectl apply -f local-k8s/argocd/application.yaml

Write-Host "✓ Stack recovery complete!" -ForegroundColor Green
Write-Host "  - Cluster: https://127.0.0.1:63569 (k8s API)"
Write-Host "  - ArgoCD: https://localhost:8081 (after: kubectl port-forward svc/argocd-server -n argocd 8081:443)"
Write-Host "  - App: http://pde.local (once ArgoCD syncs)"
```

Run it after restart:
```powershell
cd C:\Users\Home\Desktop\project\PDE
.\local-k8s\scripts\restart-all.ps1
```

---

## Summary: What Persists After Restart

| Component | Persists? | How to Recover |
|-----------|-----------|---|
| Docker images (backend/frontend:dev) | ✓ Yes (on host disk) | Auto-available; push again if needed |
| Kind cluster data | ✓ Partially (etcd in container) | Cluster survives if container survives; recreate if lost |
| Local registry data | ✓ Yes (docker volume `kind-registry`) | Volumes persist; container restart = data survives |
| ArgoCD config | ✓ Yes (etcd in cluster) | Survives cluster restart; reinstall only if cluster deleted |
| Jenkins jobs | ✓ Yes (jenkins_home volume) | Volume persists; container restart = jobs survive |
| Git history | ✓ Yes (.git folder) | Always on disk; safe |
| Application data (PDE DB) | ✓ Yes (PG persistent volume) | Survives if PVC isn't deleted; check `kubectl get pvc -n pde` |

---

## If Everything is Lost

**Complete nuke & rebuild from git** (only takes 5-10 min):
```powershell
cd C:\Users\Home\Desktop\project\PDE

# Clean everything
kind delete cluster --name pde-dev
docker rm -f kind-registry jenkins
docker volume prune -f

# Rebuild
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
docker run -d --restart=always -p "127.0.0.1:5000:5000" --network bridge --name kind-registry registry:2
docker network connect kind kind-registry

# Rebuild images
$TAG = "dev"
docker build -t "localhost:5000/pde/backend:$TAG" pde-backend
docker push "localhost:5000/pde/backend:$TAG"
docker build -f pde-frontend/Dockerfile.prod -t "localhost:5000/pde/frontend:$TAG" pde-frontend
docker push "localhost:5000/pde/frontend:$TAG"

# Then follow Phase 7+ manually or use restart-all.ps1
```

---

## Contact Checkpoint

**Before system shutdown, run:**
```powershell
cd C:\Users\Home\Desktop\project\PDE
git add .
git commit -m "checkpoint: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') before restart"
git push
```

This ensures all uncommitted state is safe on GitHub.
