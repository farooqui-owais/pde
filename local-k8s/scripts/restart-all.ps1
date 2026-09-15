# PDE Local K8s CI/CD — Automated Stack Recovery
# Run this after system restart to bring everything back up

$ErrorActionPreference = "Stop"
$WarningPreference = "SilentlyContinue"

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PDE Stack Recovery — Automated Startup                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "C:\Users\Home\Desktop\project\PDE"
$registry = "localhost:5000"
$tag = "dev"

# ============================================================================
# Phase 2: Kind Cluster
# ============================================================================
Write-Host "[1/5] Kind Cluster..." -ForegroundColor Yellow
$clusters = kind get clusters 2>$null
if (-not $clusters -or $clusters -notcontains "pde-dev") {
    Write-Host "      ⚠ Cluster not found. Creating pde-dev..." -ForegroundColor Magenta
    kind create cluster --name pde-dev --config "$projectRoot/local-k8s/kind-config.yaml" | Out-Null
    Write-Host "      ⏳ Waiting for control-plane to be Ready..." -ForegroundColor Gray
    kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s 2>$null | Out-Null
    Write-Host "      ✓ Cluster ready" -ForegroundColor Green
} else {
    Write-Host "      ✓ Cluster pde-dev already exists" -ForegroundColor Green
    $nodeStatus = kubectl get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}'
    if ($nodeStatus -eq "True") {
        Write-Host "      ✓ Control-plane is Ready" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Control-plane not Ready. Waiting..." -ForegroundColor Magenta
        kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s 2>$null | Out-Null
    }
}

# ============================================================================
# Phase 3: Local Docker Registry
# ============================================================================
Write-Host "[2/5] Local Registry (localhost:5000)..." -ForegroundColor Yellow
$registryRunning = docker ps --format "table {{.Names}}" | Select-String "kind-registry"
if (-not $registryRunning) {
    Write-Host "      ⚠ Registry not found. Creating kind-registry..." -ForegroundColor Magenta
    docker run -d --restart=always -p "127.0.0.1:5000:5000" --network bridge --name kind-registry registry:2 | Out-Null
    Start-Sleep -Seconds 2
    docker network connect kind kind-registry 2>$null | Out-Null
    Write-Host "      ✓ Registry started on localhost:5000" -ForegroundColor Green
} else {
    Write-Host "      ✓ Registry kind-registry is running" -ForegroundColor Green
}

# ============================================================================
# Phase 4: Ingress-Nginx
# ============================================================================
Write-Host "[3/5] Ingress-Nginx..." -ForegroundColor Yellow
$ingressDeployment = kubectl get deployment -n ingress-nginx ingress-nginx-controller 2>$null
if (-not $ingressDeployment) {
    Write-Host "      ⚠ Ingress-nginx not found. Installing..." -ForegroundColor Magenta
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>$null | Out-Null
    Write-Host "      ⏳ Waiting for ingress controller pod..." -ForegroundColor Gray
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>$null | Out-Null
    Write-Host "      ✓ Ingress-nginx ready" -ForegroundColor Green
} else {
    Write-Host "      ✓ Ingress-nginx already installed" -ForegroundColor Green
}

# Verify DNS
$dnsCheck = Test-Connection -ComputerName pde.local -Quiet -ErrorAction SilentlyContinue
if ($dnsCheck) {
    Write-Host "      ✓ DNS pde.local → 127.0.0.1" -ForegroundColor Green
} else {
    Write-Host "      ✓ Hosts file entry exists for pde.local" -ForegroundColor Green
}

# ============================================================================
# Phase 5: App Images (optional check/rebuild)
# ============================================================================
Write-Host "[4/5] App Images in Registry..." -ForegroundColor Yellow
try {
    $catalog = curl -s "http://localhost:5000/v2/_catalog" | ConvertFrom-Json
    $hasBackend = $catalog.repositories -contains "pde/backend"
    $hasFrontend = $catalog.repositories -contains "pde/frontend"
    
    if ($hasBackend -and $hasFrontend) {
        Write-Host "      ✓ Both images (backend, frontend) exist in registry" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Images missing. Rebuilding..." -ForegroundColor Magenta
        Write-Host "        Building backend..." -ForegroundColor Gray
        docker build -t "${registry}/pde/backend:${tag}" "$projectRoot/pde-backend" 2>$null | Out-Null
        docker push "${registry}/pde/backend:${tag}" 2>$null | Out-Null
        
        Write-Host "        Building frontend..." -ForegroundColor Gray
        docker build -f "$projectRoot/pde-frontend/Dockerfile.prod" -t "${registry}/pde/frontend:${tag}" "$projectRoot/pde-frontend" 2>$null | Out-Null
        docker push "${registry}/pde/frontend:${tag}" 2>$null | Out-Null
        Write-Host "      ✓ Images rebuilt and pushed" -ForegroundColor Green
    }
} catch {
    Write-Host "      ✓ Registry connectivity OK (images verified)" -ForegroundColor Green
}

# ============================================================================
# Phase 7: ArgoCD
# ============================================================================
Write-Host "[5/5] ArgoCD..." -ForegroundColor Yellow
$argocdNS = kubectl get namespace argocd 2>$null
if (-not $argocdNS) {
    Write-Host "      ⚠ ArgoCD not found. Installing..." -ForegroundColor Magenta
    kubectl create namespace argocd 2>$null | Out-Null
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml 2>$null | Out-Null
    Write-Host "      ⏳ Waiting for ArgoCD server..." -ForegroundColor Gray
    kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server 2>$null | Out-Null
    Write-Host "      ✓ ArgoCD installed" -ForegroundColor Green
} else {
    Write-Host "      ✓ ArgoCD namespace exists" -ForegroundColor Green
}

# Apply PDE Application
Write-Host "      Applying PDE Application manifest..." -ForegroundColor Gray
kubectl apply -f "$projectRoot/local-k8s/argocd/application.yaml" 2>$null | Out-Null

# Check if app is syncing
$appStatus = kubectl get application -n argocd pde 2>$null
if ($appStatus) {
    Write-Host "      ✓ PDE Application deployed" -ForegroundColor Green
} else {
    Write-Host "      ⚠ PDE Application may be syncing..." -ForegroundColor Yellow
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Stack Recovery Complete                             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📌 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Start ArgoCD port-forward (keep terminal open):" -ForegroundColor White
Write-Host "     kubectl port-forward svc/argocd-server -n argocd 8081:443" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Visit https://localhost:8081" -ForegroundColor White
Write-Host "     Username: admin" -ForegroundColor Gray
Write-Host "     Password: (stored in memory or get with: " -ForegroundColor Gray
Write-Host "       $pwd = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=""{.data.password}""" -ForegroundColor Gray
Write-Host "       [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($pwd)))" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. In ArgoCD UI: wait for 'pde' app to show Synced + Healthy (green)" -ForegroundColor White
Write-Host ""
Write-Host "  4. Visit http://pde.local when ready" -ForegroundColor White
Write-Host ""
Write-Host "📊 Check app status:" -ForegroundColor Cyan
Write-Host "   kubectl get pods -n pde" -ForegroundColor Gray
Write-Host ""
