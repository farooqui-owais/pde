# PDE — Start All Port-Forwards (Convenience Script)
# Run this after restart-all.ps1to start all UI access ports

$ErrorActionPreference = "SilentlyContinue"

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PDE Port-Forwards Startup                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Killing old port-forward processes..." -ForegroundColor Yellow
Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Starting new port-forwards in background..." -ForegroundColor Cyan
Write-Host ""

# ArgoCD
Write-Host "  • ArgoCD Server (8081)" -ForegroundColor White
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/argocd-server -n argocd 8081:443" -WindowStyle Hidden

# Grafana
Write-Host "  • Grafana (3000)" -ForegroundColor White
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80" -WindowStyle Hidden

# Prometheus
Write-Host "  • Prometheus (9090)" -ForegroundColor White
Start-Process -FilePath "cmd" -ArgumentList "/c kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090" -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✓ All port-forwards started" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  - ArgoCD:     https://localhost:8081  (admin / 1qDaoHvyKurDzxoR)" -ForegroundColor Yellow
Write-Host "  - Grafana:    http://localhost:3000   (admin / pde-grafana-admin)" -ForegroundColor Yellow
Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor Yellow
Write-Host "  - Jenkins:    http://localhost:8080" -ForegroundColor Yellow
Write-Host "  - App:        http://pde.local" -ForegroundColor Yellow
Write-Host ""
