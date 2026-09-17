# =============================================================================
# setup-webhooks.ps1 - instant GitOps sync via a GitHub -> ArgoCD webhook
#
# Without a webhook, ArgoCD polls the repo every ~3 minutes before it notices
# Jenkins' tag-bump commit on the deploy/local branch. This script removes
# that lag by configuring the webhook secret ArgoCD requires and printing the
# exact GitHub-side command to register the hook.
#
# WHAT IT DOES
#   1. Generates a random webhook secret.
#   2. Patches the argocd-secret (argocd namespace) with that secret under the
#      key ArgoCD reads for GitHub webhooks: webhook.github.secret.
#   3. Prints a ready-to-run "gh api" command (and a curl fallback) that
#      registers the webhook on the repo, pointing at your ArgoCD server's
#      /api/webhook endpoint.
#
# REQUIREMENTS / NOTES
#   - kubectl on PATH, kind cluster "pde-dev" running, ArgoCD installed.
#   - The webhook URL must be REACHABLE FROM GITHUB'S SERVERS. A local kind
#     cluster (localhost:8081) is not, so you need a tunnel (ngrok / smee.io /
#     cloudflared) forwarding a public URL to your port-forwarded ArgoCD
#     server. The secret patch is harmless and can be run regardless - only
#     the GitHub-side hook needs the tunnel.
#   - Idempotent: re-running regenerates the secret. If you re-run, also
#     update the GitHub hook, or GitHub will get 401s ("invalid payload" in
#     the argocd-server logs).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File local-k8s\scripts\setup-webhooks.ps1
#   Optional:  -ArgocdUrl "https://<your-tunnel-host>" -Repo "<owner>/<repo>"
# =============================================================================

param(
    [string]$ArgocdUrl = "https://localhost:8081",
    [string]$Repo = "farooqui-owais/pde"
)

$ErrorActionPreference = "Stop"

Write-Host "== PDE GitHub -> ArgoCD webhook setup ==" -ForegroundColor Cyan

# --- 0. Sanity checks -------------------------------------------------------
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Error "kubectl not found on PATH. Install it or activate your cluster context first."
}
$ns = kubectl get namespace argocd 2>$null
if (-not $ns) {
    Write-Error "argocd namespace not found - install ArgoCD first (see local-k8s/README.md)."
}

# --- 1. Generate a random webhook secret -------------------------------------
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)

# --- 2. Patch the ArgoCD webhook secret --------------------------------------
# ArgoCD reads webhook secrets from the argocd-secret Secret's stringData,
# keyed per provider (webhook.github.secret for GitHub push events). Patching
# stringData is the documented way to add or renew webhook secrets.
kubectl patch secret argocd-secret -n argocd `
    -p "{\"stringData\":{\"webhook.github.secret\":\"$secret\"}}"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to patch argocd-secret." }
Write-Host "OK: argocd-secret patched (key: webhook.github.secret)" -ForegroundColor Green

# --- 3. Print the GitHub-side registration command ---------------------------
$hookUrl = "$ArgocdUrl/api/webhook"

Write-Host ""
Write-Host "Now register the webhook on GitHub. Easiest with the gh CLI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  gh api repos/$Repo/hooks -f name=web -f active=true -f 'events[]=push' -f 'config[url]=$hookUrl' -f 'config[content_type]=json' -f 'config[secret]=$secret'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or with curl (a token with admin:repo_hook / repo scope):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  curl -X POST -H 'Authorization: Bearer <YOUR_TOKEN>' https://api.github.com/repos/$Repo/hooks -d '{\"name\":\"web\",\"active\":true,\"events\":[\"push\"],\"config\":{\"url\":\"$hookUrl\",\"content_type\":\"json\",\"secret\":\"$secret\"}}'" -ForegroundColor Yellow
Write-Host ""

# --- 4. Reachability reminder ------------------------------------------------
if ($ArgocdUrl -match "localhost|127\.0\.0\.1") {
    Write-Warning "The URL '$hookUrl' is only reachable from THIS machine."
    Write-Warning "GitHub's servers cannot reach a localhost kind cluster - for the"
    Write-Warning "webhook to actually fire, expose ArgoCD via a tunnel, e.g.:"
    Write-Warning ""
    Write-Warning "  ngrok http 8081"
    Write-Warning "  # or: npx smee-client --url <smee-url> --target http://localhost:8081"
    Write-Warning ""
    Write-Warning "Then re-run this script with:  -ArgocdUrl 'https://<your-tunnel-host>'"
}

Write-Host "Verification (once a push lands): the ArgoCD app history should show"
Write-Host "'Webhook refreshed pde' within seconds instead of after ~3 minutes."
