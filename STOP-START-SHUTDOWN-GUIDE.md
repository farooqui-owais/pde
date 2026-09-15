# PDE Local Kubernetes CI/CD — Stop, Shutdown & Restart Guide

This guide covers how to properly stop your stack, shutdown your PC, and restore everything when you restart.

---

## 🛑 STOPPING THE STACK (Before Shutdown)

### Option 1: Graceful Stop (Preserve Everything)

**Best for:** Quick breaks, testing, or before shutdown

```powershell
# Stop all containers but keep data
docker stop $(docker ps -q)

# Verify stopped
docker ps
# Expected: (empty - no running containers)
```

**What's preserved:**
- ✓ Docker volumes (jenkins_home, local registry data)
- ✓ Kind cluster data (etcd in container, but stopped)
- ✓ Git history
- ✓ All configuration

**Time to stop:** ~10 seconds

---

### Option 2: Complete Cleanup (Start Fresh)

**Best for:** Starting completely fresh, or if something broke

```powershell
# Delete everything (CAUTION: deletes volumes and clusters)
docker stop $(docker ps -q)
docker rm -f $(docker ps -aq)
docker volume prune -f
kind delete cluster --name pde-dev
```

**What's deleted:**
- ✗ Kind cluster
- ✗ Jenkins jobs & configuration
- ✗ Local registry images
- ✗ All containers

**When to use:** Only if you want to start completely fresh

---

## ⚠️ BEFORE SHUTTING DOWN YOUR PC

**ALWAYS commit your work to GitHub:**

```powershell
cd C:\Users\Home\Desktop\project\PDE

# Check for uncommitted changes
git status

# If there are changes:
git add .
git commit -m "checkpoint: stable state before PC shutdown - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push

# Verify push succeeded
git log --oneline -3
```

**Why?**
- Your code changes are safe in GitHub
- If local volumes get corrupted, you can recover from git
- Ensures you don't lose work

---

## 🔄 RESTARTING AFTER PC SHUTDOWN

### Step 1: Start Docker Desktop

1. **Click Docker Desktop** in your system tray
2. **Wait 30-60 seconds** for it to fully start
3. Verify it's ready:

```powershell
docker ps
# Should respond (may be empty first time)
```

---

### Step 2: Restore the Full Stack (Automated)

Run this **ONE command** to bring everything back:

```powershell
cd C:\Users\Home\Desktop\project\PDE
.\local-k8s\scripts\restart-all.ps1
```

**What it does automatically:**
- ✓ Recreates kind cluster if deleted
- ✓ Restarts local registry
- ✓ Reinstalls ingress-nginx
- ✓ Redeploys ArgoCD
- ✓ Syncs PDE app
- ✓ Verifies all 5 phases

**Time:** 3-5 minutes

**Output:** Shows you the status of each phase

---

### Step 3: Verify Everything is Running

```powershell
# Check cluster
kubectl get nodes
# Expected: pde-dev-control-plane with status Ready

# Check pods
kubectl get pods -n pde
# Expected: postgres, pde-backend, pde-frontend all Running

# Check ArgoCD
kubectl get application -n argocd pde
# Expected: SYNC STATUS = Synced, HEALTH STATUS = Healthy

# Check Docker containers
docker ps
# Expected: pde-dev-control-plane, kind-registry, jenkins, etc.
```

---

### Step 4: Start Port-Forwards (Needed for UI Access)

These are **NOT persistent** after restart. You need to run them each time:

**Option A: Individual port-forwards (keep terminals open)**

```powershell
# Terminal 1: ArgoCD
kubectl port-forward svc/argocd-server -n argocd 8081:443

# Terminal 2: Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80

# Terminal 3: Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090

# Note: Jenkins port-forward (8080) usually works without explicit forwarding
```

**Option B: Automated script (one command)**

Add this script to your project (optional convenience):

**File: `local-k8s/scripts/start-port-forwards.ps1`**

```powershell
Write-Host "Starting port-forwards..." -ForegroundColor Cyan

# Kill any old port-forwards
Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Start in background
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/argocd-server -n argocd 8081:443" -WindowStyle Hidden
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80" -WindowStyle Hidden
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090" -WindowStyle Hidden

Start-Sleep -Seconds 2
Write-Host "✓ All port-forwards started" -ForegroundColor Green
Write-Host "  - ArgoCD: https://localhost:8081" -ForegroundColor Yellow
Write-Host "  - Grafana: http://localhost:3000" -ForegroundColor Yellow
Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor Yellow
```

Run it:
```powershell
.\local-k8s\scripts\start-port-forwards.ps1
```

---

## 📋 Full Startup Checklist

After your PC starts, follow this checklist:

```
☐ 1. Start Docker Desktop (wait 30-60 seconds)
☐ 2. Run: .\local-k8s\scripts\restart-all.ps1 (takes 3-5 minutes)
☐ 3. Verify with: kubectl get pods -n pde
☐ 4. Start port-forwards:
     - Terminal 1: kubectl port-forward svc/argocd-server -n argocd 8081:443
     - Terminal 2: kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
     - Terminal 3: kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
☐ 5. Access your apps:
     - App: http://pde.local
     - ArgoCD: https://localhost:8081
     - Jenkins: http://localhost:8080
     - Grafana: http://localhost:3000
     - Prometheus: http://localhost:9090
```

---

## 🎯 Quick Reference: Commands You'll Use Most

### Daily Workflow

**Morning (after PC restart):**
```powershell
# 1. Start Docker
# 2. Restore stack
cd C:\Users\Home\Desktop\project\PDE
.\local-k8s\scripts\restart-all.ps1

# 3. Start port-forwards
.\local-k8s\scripts\start-port-forwards.ps1

# 4. Verify ready
kubectl get pods -n pde
```

**Before shutdown:**
```powershell
# Commit your work
cd C:\Users\Home\Desktop\project\PDE
git add .
git commit -m "checkpoint: end of day $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push

# Stop everything (optional, not required)
docker stop $(docker ps -q)
```

---

## 🔧 Troubleshooting Startup Issues

### Issue: "kind cluster not found" after restart

**Solution:**
```powershell
# The script should recreate it, but if it doesn't:
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml

# Then run recovery again
.\local-k8s\scripts\restart-all.ps1
```

### Issue: "Port 8081 already in use"

**Solution:**
```powershell
# Kill old port-forward processes
Get-Process kubectl | Stop-Process -Force

# Then restart
.\local-k8s\scripts\start-port-forwards.ps1
```

### Issue: "Docker daemon not running"

**Solution:**
1. Open Docker Desktop from system tray
2. Wait 60 seconds for full initialization
3. Retry: `docker ps`

### Issue: "DNS pde.local not resolving"

**Solution:** The hosts file entry should persist. Verify it's still there:

```powershell
Select-String "pde.local" "C:\Windows\System32\drivers\etc\hosts"
# Should show: 127.0.0.1 pde.local
```

If missing, add it:
```powershell
Add-Content "C:\Windows\System32\drivers\etc\hosts" "`n127.0.0.1 pde.local"
```

### Issue: ArgoCD app shows "Unknown" sync status

**Solution:** Usually resolves in 1-2 minutes. If stuck:

```powershell
# Restart ArgoCD controller
kubectl rollout restart -n argocd statefulset/argocd-application-controller

# Wait 30 seconds and check
Start-Sleep -Seconds 30
kubectl get application -n argocd pde
```

---

## 💾 What Persists After Shutdown

| Item | Persists? | Location |
|------|-----------|----------|
| Docker images | ✓ Yes | Host disk |
| Docker volumes | ✓ Yes | `C:\ProgramData\Docker\volumes` |
| Kind cluster data | ✓ Yes | Docker volume (if container not deleted) |
| Jenkins config | ✓ Yes | `jenkins_home` volume |
| Local registry images | ✓ Yes | Registry volume |
| Git history | ✓ Yes | `.git` folder on disk |
| PostgreSQL data | ✓ Yes | PVC volume |
| App configuration | ✓ Yes | Helm values in git |
| Port-forwards | ✗ No | Terminate on PC shutdown |

---

## 🚀 Advanced: Create a Startup Batch Script

Save this as `C:\startup-pde.bat` to automate everything:

```batch
@echo off
echo Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker.exe"

timeout /t 60 /nobreak

echo.
echo Starting PDE stack recovery...
cd /d C:\Users\Home\Desktop\project\PDE
powershell -NoProfile -ExecutionPolicy Bypass -Command ".\local-k8s\scripts\restart-all.ps1"

timeout /t 10 /nobreak

echo.
echo Verifying stack...
kubectl get pods -n pde

echo.
echo To start port-forwards, run in new terminals:
echo   kubectl port-forward svc/argocd-server -n argocd 8081:443
echo   kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
echo   kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
echo.
pause
```

Then just **double-click** `startup-pde.bat` each morning!

---

## 📊 Startup Timeline

| Step | Command | Time |
|------|---------|------|
| Start Docker Desktop | Manual | 30-60s |
| Run restart-all.ps1 | `.\local-k8s\scripts\restart-all.ps1` | 3-5 min |
| Start port-forwards | `.\local-k8s\scripts\start-port-forwards.ps1` | 5s |
| **Total** | | **~4-6 minutes** |

---

## 🛠️ Manual Recovery (If Script Fails)

If `restart-all.ps1` doesn't work, here's the manual sequence:

```powershell
# 1. Create cluster
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s

# 2. Create registry
docker run -d --restart=always -p "127.0.0.1:5000:5000" --network bridge --name kind-registry registry:2
docker network connect kind kind-registry

# 3. Install ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# 4. Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server

# 5. Deploy app
kubectl apply -f local-k8s/argocd/application.yaml

# 6. Verify
kubectl get pods -n pde
```

---

## Summary

**Simple answer:**

1. **Stop:** Run `docker stop $(docker ps -q)` or just shutdown
2. **Before shutdown:** `git push` your changes to GitHub
3. **After restart:** 
   - Start Docker Desktop
   - Run `.\local-k8s\scripts\restart-all.ps1`
   - Run port-forwards (3 terminals)
   - Access apps normally

Everything automatically recovers from Docker volumes. Your data and configuration persist.

**Estimated time after restart: 4-6 minutes**

---

## Need to Just STOP (Not Shutdown)?

```powershell
# Stop all containers
docker stop $(docker ps -q)

# Stop Docker Desktop
# Click Docker icon → Quit Docker Desktop

# Restart later:
# Start Docker Desktop again
# kubectl commands will work immediately
# (cluster stays in container)
```

---

## Emergency: Everything Broke, Start Completely Fresh

```powershell
# Nuclear option
docker stop $(docker ps -q)
docker system prune -a --volumes -f
kind delete cluster --name pde-dev

# Then:
git pull  # Get latest from GitHub
.\local-k8s\scripts\restart-all.ps1  # Full rebuild
```

**Time:** ~10 minutes, but everything is fresh and clean
