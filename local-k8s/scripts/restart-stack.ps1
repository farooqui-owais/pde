# =============================================================================
# Restart the full PDE local stack after a Windows reboot or Docker restart.
#
# WHAT SURVIVES A REBOOT AUTOMATICALLY:
#   ✓  kind cluster "pde-dev"  (container auto-starts — restart policy on node)
#   ✓  kind-registry           (created with --restart=always)
#   ✓  All k8s objects         (pde / argocd / monitoring namespaces, PVCs)
#
# WHAT DOES NOT AUTO-START:
#   ✗  jenkins                 (no --restart policy at creation time)
#   ✗  kubectl port-forwards   (always manual; run start-port-forwards.ps1)
#
# USAGE:
#   cd C:\Users\Home\Desktop\project\PDE
#   powershell -File local-k8s\scripts\restart-stack.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 1. Verify Docker is running
# ---------------------------------------------------------------------------
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop first, then re-run." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Ensure kind cluster node containers are running
#    (They normally auto-start with Docker Desktop, but this handles the edge
#    case where Docker was restarted with auto-start disabled.)
# ---------------------------------------------------------------------------
$nodes = docker ps -a --filter "label=io.x-k8s.kind.cluster=pde-dev" --format "{{.Names}}"
foreach ($n in $nodes) {
    $state = docker inspect -f "{{.State.Running}}" $n
    if ($state -ne "true") {
        Write-Host "Starting kind node $n ..." -ForegroundColor Yellow
        docker start $n | Out-Null
    }
}
if (-not $nodes) {
    Write-Host "ERROR: No pde-dev cluster containers found! The cluster was deleted." -ForegroundColor Red
    Write-Host "Recreate it with:" -ForegroundColor Yellow
    Write-Host "  kind create cluster --name pde-dev --config local-k8s/kind-config.yaml"
    Write-Host "  bash local-k8s/scripts/setup-local-registry.sh"
    Write-Host "  (then re-run steps 4-10 of local-k8s/README.md)"
    exit 1
}

# ---------------------------------------------------------------------------
# 3. Ensure kind-registry is up and on the kind network
# ---------------------------------------------------------------------------
$reg = docker inspect -f "{{.State.Running}}" kind-registry 2>$null
if ($reg -ne "true") {
    if (docker inspect kind-registry 2>$null) {
        Write-Host "Starting kind-registry ..." -ForegroundColor Yellow
        docker start kind-registry | Out-Null
    } else {
        Write-Host "kind-registry container missing — recreating (re-push images afterwards):" -ForegroundColor Yellow
        docker run -d --restart=always -p 127.0.0.1:5000:5000 --name kind-registry registry:2
    }
}
$onKindNet = docker inspect -f "{{json .NetworkSettings.Networks.kind}}" kind-registry
if ($onKindNet -eq "null" -or -not $onKindNet) {
    docker network connect kind kind-registry
    Write-Host "Re-attached kind-registry to the kind network" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 4. Start Jenkins (does not auto-start after reboot)
# ---------------------------------------------------------------------------
$jen = docker inspect -f "{{.State.Running}}" jenkins 2>$null
if ($jen -ne "true") {
    if (docker inspect jenkins 2>$null) {
        Write-Host "Starting jenkins ..." -ForegroundColor Yellow
        docker start jenkins | Out-Null
    } else {
        Write-Host "jenkins container not found." -ForegroundColor Yellow
        Write-Host "Start it with the custom jenkins-pde image (see local-k8s/README.md §9):"
        Write-Host '  docker run -d --name jenkins --network kind --group-add 0 `'
        Write-Host '    -p 8080:8080 -p 50000:50000 `'
        Write-Host '    -v jenkins_home:/var/jenkins_home `'
        Write-Host '    -v //var/run/docker.sock://var/run/docker.sock `'
        Write-Host '    jenkins-pde:latest'
    }
}

# ---------------------------------------------------------------------------
# 5. Point kubectl at the cluster and wait for the node to be Ready
#
#    NOTE: The node IP is NOT hardcoded here because Docker Desktop assigns
#    IPs dynamically. If the node IP changed after a reboot (rare but possible),
#    the kubeconfig's API server address may be stale. In that case, recreate
#    the cluster or manually update ~/.kube/config with the new IP:
#      kind export kubeconfig --name pde-dev
# ---------------------------------------------------------------------------
kubectl config use-context kind-pde-dev
kubectl wait --for=condition=ready node --all --timeout=300s
kubectl get nodes

# ---------------------------------------------------------------------------
# 6. Recover pods stuck in Unknown/Error/CrashLoopBackOff state
# ---------------------------------------------------------------------------
$stuckOutput = kubectl get pods -A --no-headers 2>$null |
    Select-String "Unknown|Error|CrashLoop"
if ($stuckOutput) {
    $stuckCount = ($stuckOutput | Measure-Object).Count
    Write-Host "Found $stuckCount stuck pod(s) — rolling restart in pde + argocd namespaces ..." -ForegroundColor Yellow
    kubectl -n pde    rollout restart deploy 2>$null | Out-Null
    kubectl -n argocd rollout restart deploy 2>$null | Out-Null
    kubectl -n argocd rollout restart statefulset 2>$null | Out-Null
    Start-Sleep -Seconds 5
}

# ---------------------------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------------------------
kubectl get pods -n pde
Write-Host ""
kubectl get pods -A | Select-String -Pattern "pde|argocd|monitoring|ingress"
Write-Host ""
Write-Host "Stack restarted. Next steps:" -ForegroundColor Green
Write-Host "  1. Run: powershell -File local-k8s\scripts\start-port-forwards.ps1"
Write-Host "  2. Verify http://pde.local (app)"
Write-Host "  3. Verify https://localhost:8081 (ArgoCD)"
Write-Host "  4. Verify http://localhost:3000  (Grafana)"
