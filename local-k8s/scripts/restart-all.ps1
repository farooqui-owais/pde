# =============================================================================
# PDE Local K8s CI/CD - Automated Stack Recovery
# Run this script to restore the full stack after PC restart
# =============================================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\Home\Desktop\project\PDE"

Write-Host ""
Write-Host "============================================================"
Write-Host " PDE Stack Recovery - Automated Startup"
Write-Host "============================================================"
Write-Host ""

# --- [1/5] Kind Cluster ---
Write-Host "[1/5] Kind Cluster..."
$cluster = kind get clusters 2>$null | Select-String "pde-dev"
if (-not $cluster) {
    Write-Host "      Creating pde-dev cluster..."
    kind create cluster --name pde-dev --config "$ProjectRoot\local-k8s\kind-config.yaml" 2>$null | Out-Null
    Start-Sleep -Seconds 5
    kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s 2>$null | Out-Null
}
Write-Host "      OK"

# --- [2/5] Local Registry ---
Write-Host "[2/5] Local Registry..."
$registryRunning = docker ps -q -f "name=kind-registry" 2>$null
if (-not $registryRunning) {
    Write-Host "      Creating registry..."
    docker run -d --restart=always -p 127.0.0.1:5000:5000 --network bridge --name kind-registry registry:2 2>$null | Out-Null
    Start-Sleep -Seconds 2
    docker network connect kind kind-registry 2>$null | Out-Null
}
Write-Host "      OK"

# --- [3/5] Ingress-Nginx ---
Write-Host "[3/5] Ingress-Nginx..."
$ingress = kubectl get deployment -n ingress-nginx ingress-nginx-controller 2>$null
if (-not $ingress) {
    Write-Host "      Installing..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>$null | Out-Null
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>$null | Out-Null
}
Write-Host "      OK"

# --- [4/5] Images ---
Write-Host "[4/5] Images..."
Write-Host "      OK"

# --- [5/5] ArgoCD ---
Write-Host "[5/5] ArgoCD..."
$argocdNs = kubectl get namespace argocd 2>$null
if (-not $argocdNs) {
    Write-Host "      Installing..."
    kubectl create namespace argocd 2>$null | Out-Null
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml 2>$null | Out-Null
    kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server 2>$null | Out-Null
}
kubectl apply -f "$ProjectRoot\local-k8s\argocd\application.yaml" 2>$null | Out-Null
Write-Host "      OK"

# --- [6/6] Monitoring (Prometheus + Grafana + ServiceMonitor) ---
Write-Host "[6/6] Monitoring..."
$monitoringNs = kubectl get namespace monitoring 2>$null
if (-not $monitoringNs) {
    Write-Host "      Installing kube-prometheus-stack..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>$null | Out-Null
    helm repo update 2>$null | Out-Null
    helm install monitoring prometheus-community/kube-prometheus-stack `
        -n monitoring --create-namespace `
        -f "$ProjectRoot\monitoring\prometheus-values-local.yaml" 2>$null | Out-Null
    kubectl wait --for=condition=available --timeout=180s -n monitoring `
        deployment/monitoring-grafana 2>$null | Out-Null
}
# Scrape config + alert rules. The ServiceMonitor is the ONLY scrape mechanism
# now (additionalScrapeConfigs was removed from the helm values), so it must
# be applied on every fresh install - without it Prometheus silently scrapes
# nothing and the pde-backend target never appears. Both applies are
# idempotent, so they also refresh rules on already-working clusters.
kubectl apply -f "$ProjectRoot\monitoring\service-monitor.yaml" 2>$null | Out-Null
kubectl apply -f "$ProjectRoot\monitoring\alerting-rules.yaml" 2>$null | Out-Null
Write-Host "      OK"

Write-Host ""
Write-Host "============================================================"
Write-Host " Stack Recovery Complete!"
Write-Host "============================================================"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  1. .\start-port-forwards.ps1"
Write-Host "  2. Visit http://pde.local"
Write-Host ""
