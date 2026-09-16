# Quick Rebuild & Redeploy Reference

## Frontend Rebuild

```powershell
# Build the image
docker build -f pde-frontend/Dockerfile.prod -t localhost:5000/pde/frontend:latest ./pde-frontend

# Push to registry
docker push localhost:5000/pde/frontend:latest

# Restart deployment (pulls new image)
kubectl rollout restart deployment/pde-frontend -n pde

# Monitor rollout
kubectl rollout status deployment/pde-frontend -n pde

# Verify new pod is running
kubectl get pods -n pde -l app=pde-frontend
```

## Backend Rebuild

```powershell
# Build the image
docker build -t localhost:5000/pde/backend:latest ./pde-backend

# Push to registry
docker push localhost:5000/pde/backend:latest

# Restart deployment
kubectl rollout restart deployment/pde-backend -n pde

# Monitor rollout
kubectl rollout status deployment/pde-backend -n pde

# Verify new pod is running
kubectl get pods -n pde -l app=pde-backend
```

## Both at Once (Frontend + Backend)

```powershell
# Build both
docker build -f pde-frontend/Dockerfile.prod -t localhost:5000/pde/frontend:latest ./pde-frontend
docker build -t localhost:5000/pde/backend:latest ./pde-backend

# Push both
docker push localhost:5000/pde/frontend:latest
docker push localhost:5000/pde/backend:latest

# Restart both
kubectl rollout restart deployment/pde-frontend -n pde
kubectl rollout restart deployment/pde-backend -n pde

# Wait for rollout
kubectl rollout status deployment/pde-frontend -n pde
kubectl rollout status deployment/pde-backend -n pde

# Check all pods
kubectl get pods -n pde
```

## Verify Everything

```powershell
# Check all pods are running
kubectl get pods -n pde

# View logs of new frontend pod
kubectl logs -f deployment/pde-frontend -n pde

# View logs of new backend pod
kubectl logs -f deployment/pde-backend -n pde

# Check ArgoCD sync status
kubectl get application -n argocd pde
```

## Common Issues

**Pod stuck in ImagePullBackOff:**
- Verify image was pushed: `docker push localhost:5000/pde/frontend:latest`
- Check registry is running: `docker ps | findstr kind-registry`
- Verify image exists in registry: `curl -s http://localhost:5000/v2/_catalog`

**Rollout stuck:**
- Check pod logs: `kubectl logs <pod-name> -n pde`
- Describe deployment: `kubectl describe deployment pde-frontend -n pde`
- Force rollout: `kubectl rollout restart deployment/pde-frontend -n pde`

**Changes not appearing:**
- Hard refresh browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Clear Docker cache: `docker system prune`
- Rebuild from scratch: `docker build --no-cache ...`

## Tag Naming Convention

- `latest` = Most recent build
- `dev` = Development/stable version (used in values-local.yaml)
- `v1.0.0` = Production releases (use semantic versioning)

Current active tags in use:
- Frontend: `localhost:5000/pde/frontend:dev` (from values-local.yaml)
- Backend: `localhost:5000/pde/backend:dev` (from values-local.yaml)

To use the `latest` tag in ArgoCD, update `helm/pde/values-local.yaml`:
```yaml
frontend:
  image:
    tag: latest  # was: dev
backend:
  image:
    tag: latest  # was: dev
```

Then commit and push to trigger ArgoCD redeploy.
