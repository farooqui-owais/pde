# PDE — ULTRA-QUICK CHEAT SHEET

## Before Shutdown (REQUIRED)

```powershell
cd C:\Users\Home\Desktop\project\PDE
git add . && git commit -m "checkpoint" && git push
```

**That's it. Everything else is automatic.**

---

## After PC Restart (SIMPLE)

### 1️⃣ Start Docker Desktop
- Click Docker in system tray
- Wait 60 seconds

### 2️⃣ Run ONE Command

```powershell
cd C:\Users\Home\Desktop\project\PDE
.\local-k8s\scripts\restart-all.ps1
```

Wait 3-5 minutes.

### 3️⃣ Start Port-Forwards (NEW Terminal)

```powershell
cd C:\Users\Home\Desktop\project\PDE
.\local-k8s\scripts\start-port-forwards.ps1
```

### 4️⃣ Access Your Apps

| Service | URL |
|---------|-----|
| App | http://pde.local |
| ArgoCD | https://localhost:8081 |
| Jenkins | http://localhost:8080 |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| SonarQube *(Mode E only)* | http://localhost:9000 |

---

## Daily Workflow

**Morning:**
```
1. Start Docker Desktop (60 sec)
2. .\local-k8s\scripts\restart-all.ps1 (5 min)
3. .\local-k8s\scripts\start-port-forwards.ps1 (instant)
4. Work normally
```

**Evening (before shutdown):**
```
git add . && git commit -m "eod checkpoint" && git push
Shutdown PC
```

---

## SonarQube — Code Quality Scan (OPTIONAL)

**Rule: kind must be STOPPED first.** SonarQube uses ~2.4 GB (3.5 GB cap) and does not fit
next to the kind cluster in the 6 GB Docker VM (see `MEMORY-MANAGEMENT.md` →
Mode E).

```powershell
.\local-k8s\scripts\stop-stack.ps1     # 1. free the memory
.\local-k8s\scripts\start-sonar.ps1    # 2. SonarQube up (also fixes vm.max_map_count)

# 3. scan (first time: create project "pde" + token in the UI at localhost:9000)
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli

.\local-k8s\scripts\stop-sonar.ps1     # 4. keep data (add -Purge to wipe)
.\local-k8s\scripts\restart-stack.ps1  # 5. Kubernetes back
```

Full runbook: `sonar/SONARQUBE.md`

---

## If Something Breaks

```powershell
# Try auto-recovery
.\local-k8s\scripts\restart-all.ps1

# If still broken
docker system prune -a --volumes -f
git pull
.\local-k8s\scripts\restart-all.ps1
```

---

## Status Checks

```powershell
docker ps                    # See running containers
kubectl get pods -n pde      # See app pods
kubectl get application -n argocd pde  # ArgoCD status
kind get clusters            # See Kubernetes clusters
```

---

## What You Need to Know

✓ **Persists after restart:** Images, volumes, data, code, git history  
✗ **Doesn't persist:** Port-forwards (restart them)  
⏱️ **Restart time:** ~5-6 minutes total  
🔐 **Data is safe:** Always commit before shutdown  

---

## That's All You Need!

Everything else is automated.
