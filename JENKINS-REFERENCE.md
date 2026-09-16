# Jenkins Pipeline - Quick Reference

## Jenkins Status

- **URL**: http://localhost:8080
- **Job Name**: pde-local
- **Status**: ✅ Ready to run
- **Installed Tools**:
  - Python 3.13.5
  - Node.js v20.19.2
  - npm 9.2.0
  - git 2.47.3
  - Docker CLI (via mounted socket)

## Running the Pipeline

### Option 1: Web UI (Recommended)
1. Open http://localhost:8080
2. Click **pde-local** in the left sidebar
3. Click **Build Now**
4. Watch the pipeline stages progress in real-time

### Option 2: Command Line
```powershell
curl -X POST http://localhost:8080/job/pde-local/build
```

### Option 3: PowerShell Script
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/job/pde-local/build" -Method POST
```

## Pipeline Stages

The `pde-local` pipeline performs:

1. **Checkout** — Clones from GitHub (https://github.com/farooqui-owais/pde.git)
2. **Backend Quality Gate** — Runs pytest tests on pde-backend
3. **Frontend Quality Gate** — Runs npm lint and npm build on pde-frontend
4. **Build & Push Images** — Builds and pushes to localhost:5000:
   - `localhost:5000/pde/backend:<tag>`
   - `localhost:5000/pde/frontend:<tag>`
5. **Bump image tags for ArgoCD** — Updates helm/pde/values-local.yaml with new tag
6. **Commit & Push** — Pushes updated values back to GitHub
7. **Auto-Sync** — ArgoCD detects the change and syncs the cluster

## Monitoring the Build

### In Jenkins UI
- Click the **Console Output** link to see full logs
- Watch the **Pipeline** view to see stage-by-stage progress

### From Command Line
```powershell
# View Jenkins logs
docker logs jenkins -f

# Check if images were pushed
curl -s http://localhost:5000/v2/_catalog | ConvertFrom-Json

# Check if ArgoCD synced
kubectl get application -n argocd pde

# Check deployed pods
kubectl get pods -n pde
```

## Troubleshooting

### Build Fails with "python3: not found"
Python 3 is now installed. If you still get this error, reinstall:
```powershell
docker exec -u root jenkins sh -c "apt-get update && apt-get install -y python3 python3-venv python3-pip"
```

### Build Fails with "npm: not found"
```powershell
docker exec -u root jenkins sh -c "apt-get install -y nodejs npm"
```

### Build Fails with "docker: not found"
Docker socket is mounted. Verify:
```powershell
docker exec jenkins ls -la /var/run/docker.sock
```

### Git Credentials Error
Ensure credentials are configured in Jenkins UI:
1. Manage Jenkins → Credentials → System → Global credentials
2. Credentials ID must be: **git-creds**

### Images Not Appearing in Registry
```powershell
# Check registry is running
docker ps | Select-String "kind-registry"

# Test registry connectivity
curl http://localhost:5000/v2/_catalog
```

## CI/CD Flow Explained

```
Code Change
    ↓
GitHub Webhook (if configured) OR Manual "Build Now"
    ↓
Jenkins Pipeline Runs
    ├─ Tests code (backend + frontend)
    ├─ Builds Docker images
    ├─ Pushes to localhost:5000
    └─ Updates values-local.yaml + commits to GitHub
    ↓
GitHub receives push event
    ↓
ArgoCD detects new commit
    ↓
ArgoCD syncs cluster with new image tags
    ↓
Kubernetes pulls new images and restarts pods
    ↓
New version is live at http://pde.local
```

## Environment

- Jenkins Container: `jenkins:lts` (Docker image)
- Network: `kind` (connects to Kubernetes cluster)
- Volume: `jenkins_home` (persists jobs, workspace, credentials)
- Mounts:
  - `/var/jenkins_home` — Jenkins home directory
  - `/var/run/docker.sock` — Docker socket for building images

## Next Steps

1. Run the pipeline: **Build Now** in Jenkins UI
2. Monitor in ArgoCD UI: https://localhost:8081
3. Check updated frontend: http://pde.local

---

**Last Updated**: After fixing Python 3 installation
**Pipeline Job**: pde-local (ready to run)
**Status**: All dependencies installed ✅
