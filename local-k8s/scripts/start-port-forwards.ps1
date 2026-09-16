# =============================================================================
# PDE — Start All Port-Forwards
#
# Run this after restart-stack.ps1 to start UI access ports for all services.
#
# USAGE:
#   cd C:\Users\Home\Desktop\project\PDE
#   powershell -File local-k8s\scripts\start-port-forwards.ps1
#
# ACCESS URLs (after this script runs):
#   App         http://pde.local           (via ingress-nginx, no port-forward needed)
#   Jenkins     http://localhost:8080
#   ArgoCD      https://localhost:8081     (accept self-signed cert warning)
#   Grafana     http://localhost:3000
#   Prometheus  http://localhost:9090
# =============================================================================

$ErrorActionPreference = "SilentlyContinue"

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PDE Port-Forwards Startup                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping any existing port-forward processes ..." -ForegroundColor Yellow
Get-Process kubectl -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*port-forward*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Starting port-forwards in background ..." -ForegroundColor Cyan
Write-Host ""

# ArgoCD (HTTPS — accept the self-signed cert in the browser)
Write-Host "  • ArgoCD (8081)" -ForegroundColor White
Start-Process -FilePath "cmd" `
    -ArgumentList "/c kubectl port-forward svc/argocd-server -n argocd 8081:443" `
    -WindowStyle Hidden

# Grafana
Write-Host "  • Grafana (3000)" -ForegroundColor White
Start-Process -FilePath "cmd" `
    -ArgumentList "/c kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80" `
    -WindowStyle Hidden

# Prometheus
Write-Host "  • Prometheus (9090)" -ForegroundColor White
Start-Process -FilePath "cmd" `
    -ArgumentList "/c kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090" `
    -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✓ Port-forwards started" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  App        : http://pde.local           (ingress — no port-forward)" -ForegroundColor White
Write-Host "  Jenkins    : http://localhost:8080" -ForegroundColor White
Write-Host "  ArgoCD     : https://localhost:8081" -ForegroundColor White
Write-Host "  Grafana    : http://localhost:3000       (admin / pde-grafana-admin)" -ForegroundColor White
Write-Host "  Prometheus : http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "ArgoCD password (retrieve dynamically — never stored in scripts):" -ForegroundColor Yellow
Write-Host '  $b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"' -ForegroundColor Gray
Write-Host '  [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))' -ForegroundColor Gray
Write-Host ""
