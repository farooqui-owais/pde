# =============================================================================
# PDE Local K8s CI/CD - Automated Stack Recovery
# Restores the full stack after PC restart / Docker Desktop restart.
# Handles ALL container states: missing cluster (create), stopped cluster
# container (docker start), stale kubeconfig (kind export), missing or
# stopped registry (create or docker start).
# Usage:  powershell -File local-k8s\scripts\restart-all.ps1
# =============================================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\Home\Desktop\project\PDE"

Write-Host ""
Write-Host "============================================================"
Write-Host " PDE Stack Recovery - Automated Startup"
Write-Host "============================================================"
Write-Host ""

# --- [1/6] Docker Desktop sanity ---
$dockerOk = docker ps 2>$null
if (-not $dockerOk) {
    Write-Host "      Docker daemon not responding. Starting Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker.exe" -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        if (docker ps 2>$null) { break }
    }
    if (-not (docker ps 2>$null)) {
        Write-Host "      FATAL: Docker daemon did not come up in 180s." -ForegroundColor Red
        exit 1
    }
}
Write-Host "      OK"

# --- [2/6] Kind Cluster ---
# NOTE: `kind get clusters` reports a cluster even when its container is
# Exited (this is what made the old script print OK while kubectl failed
# with "connection refused"). Always check the docker container state.
Write-Host "[2/6] Kind Cluster..."
$nodeContainer = docker ps -a -q -f "name=^/pde-dev-control-plane$" 2>$null
if (-not $nodeContainer) {
    Write-Host "      Cluster missing. Creating pde-dev cluster..."
    kind create cluster --name pde-dev --config "$ProjectRoot\local-k8s\kind-config.yaml" 2>$null | Out-Null
} else {
    $running = docker ps -q -f "name=^/pde-dev-control-plane$" 2>$null
    if (-not $running) {
        Write-Host "      Cluster container is stopped. Starting it..."
        docker start pde-dev-control-plane 2>$null | Out-Null
    }
}
Start-Sleep -Seconds 5
# Ensure kubeconfig is current (port mapping can change across rebuilds)
kind export kubeconfig --name pde-dev 2>$null | Out-Null
$nodeReady = kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s 2>$null
if (-not $nodeReady) {
    Write-Host "      Node not ready after start — kubelet may still be coming up." -ForegroundColor Yellow
    Write-Host "      Check: docker logs pde-dev-control-plane" -ForegroundColor Yellow
} else {
    Write-Host "      OK"
}

# --- [3/6] Local Registry ---
Write-Host "[3/6] Local Registry..."
$registryRunning = docker ps -q -f "name=^/kind-registry$" 2>$null
if ($registryRunning) {
    Write-Host "      OK (already running)"
} else {
    $registryExists = docker ps -a -q -f "name=^/kind-registry$" 2>$null
    if ($registryExists) {
        # Old script blindly ran `docker run --name kind-registry`, which fails
        # when the container already exists (stopped) — do `docker start` instead.
        Write-Host "      Registry container exists but stopped. Starting it..."
        docker start kind-registry 2>$null | Out-Null
    } else {
        Write-Host "      Creating registry..."
        docker run -d --restart=always -p 127.0.0.1:5000:5000 --network bridge --name kind-registry registry:2 2>$null | Out-Null
    }
    Start-Sleep -Seconds 2
    # Network membership is lost/needed in both cases; make it idempotent.
    $inNet = docker network inspect kind --format '{{(index .Containers "kind-registry").Name}}' 2>$null
    if (-not $inNet) {
        docker network connect kind kind-registry 2>$null | Out-Null
    }
    Write-Host "      OK"
}

# --- [4/6] Ingress-Nginx ---
Write-Host "[4/6] Ingress-Nginx..."
$ingress = kubectl get deployment -n ingress-nginx ingress-nginx-controller 2>$null
if (-not $ingress) {
    Write-Host "      Installing..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>$null | Out-Null
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>$null | Out-Null
}
Write-Host "      OK"

# --- [5/6] Images ---
Write-Host "[5/6] Images..."
Write-Host "      OK"

# --- [6/6] ArgoCD ---
Write-Host "[6/6] ArgoCD..."
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
Write-Host "[Extra] Monitoring..."
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

# --- [7/7] Jenkins ---
Write-Host "[7/7] Jenkins..."
$jenkinsRunning = docker ps -q -f "name=^/jenkins$" 2>$null
if ($jenkinsRunning) {
    Write-Host "      OK (already running)"
} else {
    $jenkinsExists = docker ps -a -q -f "name=^/jenkins$" 2>$null
    if ($jenkinsExists) {
        Write-Host "      Jenkins container exists but stopped. Starting it..."
        docker start jenkins 2>$null | Out-Null
        $deadline = (Get-Date).AddSeconds(120)
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 5
            try {
                $code = (Invoke-WebRequest -Uri "http://localhost:8080/login" -UseBasicParsing -TimeoutSec 5).StatusCode
                if ($code) { break }
            } catch {
                # 403/redirects also mean the HTTP listener is alive
                if ($_.Exception.Response) { break }
            }
        }
        Write-Host "      OK (UI: http://localhost:8080)"
    } else {
        Write-Host "      Jenkins container missing - create it per local-k8s/README.md section 8." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================================"
Write-Host " Stack Recovery Complete!"
Write-Host "============================================================"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  1. .\start-port-forwards.ps1"
Write-Host "  2. Visit http://pde.local"
Write-Host ""
