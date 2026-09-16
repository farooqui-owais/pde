# Manual Startup Guide (if restart-all.ps1 fails)

If the `restart-all.ps1` script has issues, follow these commands manually:

## Step 1: Create Kind Cluster

```powershell
cd C:\Users\Home\Desktop\project\PDE
kind create cluster --name pde-dev --config local-k8s/kind-config.yaml
kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s
```

## Step 2: Create Local Registry

```powershell
docker run -d --restart=always -p 127.0.0.1:5000:5000 --network bridge --name kind-registry registry:2
docker network connect kind kind-registry
```

## Step 3: Install Ingress-Nginx

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

## Step 4: Build & Push Images

```powershell
$REGISTRY = "localhost:5000"
$TAG = "dev"

# Backend
docker build -t "$REGISTRY/pde/backend:$TAG" pde-backend
docker push "$REGISTRY/pde/backend:$TAG"

# Frontend
docker build -f pde-frontend/Dockerfile.prod -t "$REGISTRY/pde/frontend:$TAG" pde-frontend
docker push "$REGISTRY/pde/frontend:$TAG"
```

## Step 5: Install ArgoCD

```powershell
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server
```

## Step 6: Deploy PDE App

```powershell
kubectl apply -f local-k8s/argocd/application.yaml
```

## Step 7: Verify Everything

```powershell
# Check pods
kubectl get pods -n pde

# Should see: postgres, pde-backend, pde-frontend all Running

# Check ArgoCD
kubectl get application -n argocd pde

# Should see: SYNC STATUS = Synced, HEALTH STATUS = Healthy
```

## Step 8: Start Port-Forwards

```powershell
# In separate terminals:

# Terminal 1
kubectl port-forward svc/argocd-server -n argocd 8081:443

# Terminal 2
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80

# Terminal 3
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
```

## Step 9: Access Your Apps

- App: http://pde.local
- ArgoCD: https://localhost:8081
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
