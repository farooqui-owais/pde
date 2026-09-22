# =============================================================================
# Stop the optional self-hosted SonarQube stack.
#
# Data is PRESERVED by default: the compose project is brought down WITHOUT
# -v, so sonar_pgdata / sonar_data / sonar_extensions / sonar_logs / sonar_temp
# all survive. Re-running start-sonar.ps1 resumes with your projects, tokens
# and analysis history intact.
#
# USAGE
#   powershell -File local-k8s\scripts\stop-sonar.ps1            # keep data
#   powershell -File local-k8s\scripts\stop-sonar.ps1 -Purge     # DELETE all data
#
# (Path resolution below finds the repo root by walking up to
#  docker-compose.sonar.yml, so the same file also runs unchanged from the
#  original staged location sonar\scripts\.)
# =============================================================================

param(
    [switch]$Purge
)

$ErrorActionPreference = "Continue"

$COMPOSE_PROJECT = "pde-sonar"

function Write-Ok    ($m) { Write-Host $m -ForegroundColor Green }
function Write-Warn2 ($m) { Write-Host $m -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# 0. Locate the repo root (same logic as start-sonar.ps1 - works from either
#    sonar\scripts\ or local-k8s\scripts\)
# ---------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = $scriptDir
while ($repoRoot -and -not (Test-Path (Join-Path $repoRoot "docker-compose.sonar.yml"))) {
    $parent = Split-Path -Parent $repoRoot
    if (-not $parent -or $parent -eq $repoRoot) { $repoRoot = $null; break }
    $repoRoot = $parent
}

# ---------------------------------------------------------------------------
# 1. Detach from the kind network first (so the network itself stays intact for
#    Jenkins / the registry / future scans)
# ---------------------------------------------------------------------------
$onKind = docker inspect -f "{{json .NetworkSettings.Networks.kind}}" pde-sonar 2>$null
if ($onKind -and $onKind -ne "null") {
    Write-Host "Disconnecting pde-sonar from the 'kind' network ..."
    docker network disconnect -f kind pde-sonar 2>$null | Out-Null
}

# ---------------------------------------------------------------------------
# 2. Bring the stack down
# ---------------------------------------------------------------------------
if (-not $repoRoot) {
    Write-Warn2 "docker-compose.sonar.yml not found in any parent folder - using docker stop."
    docker stop -t 120 pde-sonar    | Out-Null
    docker stop -t 30  pde-sonar-db | Out-Null
} else {
    $composeFile = Join-Path $repoRoot "docker-compose.sonar.yml"
    if ($Purge) {
        Write-Warn2 "PURGE requested - all SonarQube projects, tokens, quality gates,"
        Write-Warn2 "and the analysis database will be DELETED (irreversible)."
        $confirm = Read-Host "Type 'delete' to confirm"
        if ($confirm -ne "delete") {
            Write-Warn2 "Purge cancelled - stopping the stack but keeping data."
            docker compose -p $COMPOSE_PROJECT -f $composeFile down
        } else {
            docker compose -p $COMPOSE_PROJECT -f $composeFile down -v
            Write-Ok "Stack and volumes removed."
        }
    } else {
        Write-Host "Stopping SonarQube stack (volumes preserved) ..."
        docker compose -p $COMPOSE_PROJECT -f $composeFile down
    }
}

Write-Host ""
Write-Ok "==============================================================================="
Write-Ok "  SonarQube stopped."
Write-Ok "==============================================================================="
Write-Host "  Restart the normal local stack when you need it:"
Write-Host "    powershell -File local-k8s\scripts\restart-stack.ps1"
Write-Host ""
Write-Host "  Restart SonarQube later (kind must be stopped first - Mode E):"
Write-Host "    powershell -File local-k8s\scripts\start-sonar.ps1"
Write-Ok "==============================================================================="
