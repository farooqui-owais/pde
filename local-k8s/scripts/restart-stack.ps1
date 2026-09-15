# =============================================================================
# Restart the full PDE local stack after a Windows reboot / Docker restart.
#
# What survives a reboot automatically (verified on this machine):
#   - kind cluster "pde-dev"   (container pde-dev-control-plane, auto-starts)
#   - kind-registry            (created with --restart=always)
#   - all k8s objects (pde/argocd/monitoring namespaces, PVCs, ingress)
#
# What does NOT auto-start:
#   - jenkins container (no restart policy at creation)
#
# Usage:  powershell -File local-k8s\scripts\restart-stack.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# 1. Wait for Docker itself
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Start Docker Desktop first, then re-run." -ForegroundColor Red
  exit 1
}

# 2. Ensure the kind cluster containers are running (they normally auto-start,
#    but this covers the case where Docker was told not to restart them)
$nodes = docker ps -a --filter "label=io.x-k8s.kind.cluster=pde-dev" --format "{{.Names}}"
foreach ($n in $nodes) {
  $state = docker inspect -f "{{.State.Running}}" $n
  if ($state -ne "true") {
    Write-Host "Starting kind node $n ..."
    docker start $n | Out-Null
  }
}
if (-not $nodes) {
  Write-Host "No pde-dev cluster containers found! Cluster was deleted - recreate it:" -ForegroundColor Red
  Write-Host "  kind create cluster --name pde-dev --config local-k8s/kind-config.yaml"
  Write-Host "  bash local-k8s/scripts/setup-local-registry.sh"
  Write-Host "  (then re-run steps 4-10 of local-k8s/README.md)"
  exit 1
}

# 3. Ensure the registry is up and attached to the kind network
$reg = docker inspect -f "{{.State.Running}}" kind-registry 2>$null
if ($reg -ne "true") {
  if (docker inspect kind-registry 2>$null) {
    Write-Host "Starting kind-registry ..."
    docker start kind-registry | Out-Null
  } else {
    Write-Host "kind-registry container missing - recreating (images persist in container layer only if volume was used; otherwise re-push):" -ForegroundColor Yellow
    docker run -d --restart=always -p 127.0.0.1:5000:5000 --name kind-registry registry:2
  }
}
$onKindNet = docker inspect -f "{{json .NetworkSettings.Networks.kind}}" kind-registry
if ($onKindNet -eq "null" -or -not $onKindNet) {
  docker network connect kind kind-registry
  Write-Host "Re-attached kind-registry to the kind network"
}

# 4. Start Jenkins (does not auto-start after reboot)
$jen = docker inspect -f "{{.State.Running}}" jenkins 2>$null
if ($jen -ne "true") {
  if (docker inspect jenkins 2>$null) {
    Write-Host "Starting jenkins ..."
    docker start jenkins | Out-Null
  } else {
    Write-Host "jenkins container not found - start it manually (local-k8s/README.md section 9)" -ForegroundColor Yellow
  }
}

# 5. IMPORTANT (Windows/Docker Desktop quirk): after a reboot the node
#    container can come back with a DIFFERENT Docker IP, but the in-node
#    API server/kubelet config is bound to the original IP (172.18.0.5).
#    Also, stale network endpoint leases from before the reboot can squat
#    on that IP. Fix both: purge stale endpoints, then pin the IP.
$desiredIp = "172.18.0.2"
$members = docker network inspect kind --format "{{range .Containers}}{{.Name}} {{end}}"
foreach ($m in $members) {
  if ($m -notin @("pde-dev-control-plane", "kind-registry", "jenkins") -and $m) {
    Write-Host "Removing stale kind network endpoint: $m"
    docker network disconnect -f kind $m 2>$null | Out-Null
  }
}
$nodeIp = docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" pde-dev-control-plane
if ($nodeIp -ne $desiredIp) {
  Write-Host "Node IP is '$nodeIp' (expected $desiredIp) - re-pinning..."
  docker network disconnect kind pde-dev-control-plane 2>$null | Out-Null
  docker network connect --ip $desiredIp kind pde-dev-control-plane 2>$null | Out-Null
  docker start pde-dev-control-plane 2>$null | Out-Null
  docker restart pde-dev-control-plane 2>$null | Out-Null
}

# 6. Point kubectl at the cluster and wait for it to be healthy
kubectl config use-context kind-pde-dev
kubectl wait --for=condition=ready node --all --timeout=300s
kubectl get nodes

# 7. Recover any pods stuck in Unknown/Error state after the outage
$stuck = kubectl get pods -A --field-selector=status.phase=Running --no-headers 2>$null |
  Select-String "Unknown|Error|CrashLoop" | Measure-Object
if ($stuck.Count -gt 0) {
  Write-Host "Recovering stuck pods (rollout restart in pde namespace)..."
  kubectl -n pde rollout restart deploy
  kubectl -n argocd rollout restart deploy
  kubectl -n argocd rollout restart statefulset 2>$null | Out-Null
  Start-Sleep 5
}

kubectl get pods -n pde
kubectl get pods -A | Select-String -Pattern "pde|argocd|monitoring|ingress"

Write-Host "`nStack restarted. Verify http://pde.local and the checklist in local-k8s/README.md section 11." -ForegroundColor Green
