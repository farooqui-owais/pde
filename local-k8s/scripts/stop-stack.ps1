# =============================================================================
# Gracefully stop the PDE local stack (e.g. before shutting down the PC) while
# KEEPING everything — no data loss, no rebuild needed on next start.
#
# Usage:  powershell -File local-k8s\scripts\stop-stack.ps1
# =============================================================================

$ErrorActionPreference = "Continue"

Write-Host "Stopping jenkins ..."
docker stop -t 30 jenkins 2>$null | Out-Null

Write-Host "Gracefully stopping kind cluster pde-dev (flushing etcd WAL)..."
docker stop -t 60 pde-dev-control-plane 2>$null | Out-Null

Write-Host "Stopping kind-registry ..."
docker stop -t 15 kind-registry 2>$null | Out-Null

Write-Host "`nAll stopped. State is preserved (kubectl context kind-pde-dev, deployments,"
Write-Host "PVCs, registry images, jenkins_home volume all intact)."
Write-Host "Next session:  powershell -File local-k8s\scripts\restart-stack.ps1" -ForegroundColor Green
