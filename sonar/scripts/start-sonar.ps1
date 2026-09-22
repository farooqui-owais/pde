# =============================================================================
# Start the optional self-hosted SonarQube stack for local code-quality scans.
#
# This is "Mode E" in MEMORY-MANAGEMENT.md and it is DELIBERATELY separate from
# the normal local stack:
#
#   * MEMORY  - SonarQube (cap 3.5 GiB) + its Postgres (256 MiB) + a scanner
#               container (512 MiB) do NOT fit alongside the kind cluster
#               (2.4-2.8 GiB) in a 5.79 GiB Docker VM. kind is stopped first.
#   * KERNEL  - SonarQube's embedded Elasticsearch needs
#               vm.max_map_count >= 524288. Docker Desktop's WSL2 VM reports
#               262144 and does NOT persist the value across a Docker Desktop
#               restart, so it is re-applied here on every single run,
#               BEFORE `compose up`.
#
# USAGE
#   cd C:\Users\Home\Desktop\project\PDE
#   powershell -File sonar\scripts\start-sonar.ps1
#
#   After promotion to local-k8s\scripts\ the same command becomes:
#   powershell -File local-k8s\scripts\start-sonar.ps1
#   (path resolution below handles both locations unchanged)
# =============================================================================

$ErrorActionPreference = "Stop"

$COMPOSE_PROJECT  = "pde-sonar"
$MAP_COUNT_MIN    = 524288
$BOOT_TIMEOUT_MIN = 5

function Write-Step  ($m) { Write-Host "`n$m" -ForegroundColor Cyan }
function Write-Ok    ($m) { Write-Host $m -ForegroundColor Green }
function Write-Warn2 ($m) { Write-Host $m -ForegroundColor Yellow }
function Write-Err   ($m) { Write-Host $m -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 0. Locate the repo root by walking up until docker-compose.sonar.yml is found.
#    Works from sonar\scripts\ (staged) AND local-k8s\scripts\ (promoted).
# ---------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = $scriptDir
while ($repoRoot -and -not (Test-Path (Join-Path $repoRoot "docker-compose.sonar.yml"))) {
    $parent = Split-Path -Parent $repoRoot
    if (-not $parent -or $parent -eq $repoRoot) { $repoRoot = $null; break }
    $repoRoot = $parent
}
if (-not $repoRoot) {
    Write-Err "ERROR: could not find docker-compose.sonar.yml in any parent folder of:"
    Write-Err "       $scriptDir"
    Write-Warn2 "Copy it to the repo root first (see sonar/README.md)."
    exit 1
}
$composeFile = Join-Path $repoRoot "docker-compose.sonar.yml"
Write-Host "Repo root : $repoRoot"
Write-Host "Compose   : $composeFile"

# ---------------------------------------------------------------------------
# 1. Docker must be reachable
# ---------------------------------------------------------------------------
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Err "Docker is not running. Start Docker Desktop first, then re-run."
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Memory guard - the kind cluster must be STOPPED (Mode E)
# ---------------------------------------------------------------------------
Write-Step "Checking for the kind cluster (it does not fit alongside SonarQube)..."
$kindNodes = docker ps --filter "label=io.x-k8s.kind.cluster=pde-dev" --format "{{.Names}}"
if ($kindNodes) {
    Write-Warn2 "kind cluster 'pde-dev' is running: $($kindNodes -join ', ')"
    Write-Warn2 "It consumes 2.4-2.8 GiB; this SonarQube stack needs ~2.8 GiB."
    Write-Warn2 "Together they exceed the 5.79 GiB Docker VM and will trigger OOMKills."
    $answer = Read-Host "Stop the kind stack now? [y/N]"
    if ($answer -match '^[Yy]') {
        $stopStack = Join-Path $repoRoot "local-k8s\scripts\stop-stack.ps1"
        if (Test-Path $stopStack) {
            & powershell -ExecutionPolicy Bypass -File $stopStack
        } else {
            Write-Warn2 "local-k8s\scripts\stop-stack.ps1 not found - stop kind manually:"
            Write-Warn2 "  docker stop pde-dev-control-plane; docker stop kind-registry; docker stop jenkins"
        }
    } else {
        Write-Err "Aborted. Not starting SonarQube while kind is running (would OOM)."
        exit 1
    }
} else {
    Write-Ok "kind cluster not running - memory budget is clear."
}

# ---------------------------------------------------------------------------
# 3. Kernel prerequisite - vm.max_map_count (re-applied every run)
# ---------------------------------------------------------------------------
Write-Step "Raising vm.max_map_count inside the Docker Desktop WSL2 VM..."
wsl -d docker-desktop sysctl -w vm.max_map_count=$MAP_COUNT_MIN 2>$null | Out-Null

$mapCount = 0
$rawMap = (wsl -d docker-desktop sysctl -n vm.max_map_count 2>&1 | Out-String)
if ($rawMap -match '(\d+)') { $mapCount = [int]$Matches[1] }
if ($mapCount -ge $MAP_COUNT_MIN) {
    Write-Ok "vm.max_map_count = $mapCount (>= $MAP_COUNT_MIN) - OK"
} else {
    Write-Warn2 "vm.max_map_count = $mapCount (need >= $MAP_COUNT_MIN)."
    Write-Warn2 "SonarQube's embedded Elasticsearch may refuse to bootstrap."
    Write-Warn2 "Fix manually with: wsl -d docker-desktop sysctl -w vm.max_map_count=$MAP_COUNT_MIN"
}

$rawFileMax = (wsl -d docker-desktop sysctl -n fs.file-max 2>&1 | Out-String)
if ($rawFileMax -match '(\d+)') {
    $fileMax = [int64]$Matches[1]
    if ($fileMax -ge 131072) { Write-Ok "fs.file-max = $fileMax - OK" }
    else { Write-Warn2 "fs.file-max = $fileMax (need >= 131072) - SonarQube may complain." }
}

# ---------------------------------------------------------------------------
# 4. Bring the stack up (isolated compose project name)
# ---------------------------------------------------------------------------
Write-Step "Starting SonarQube + Postgres (compose project '$COMPOSE_PROJECT')..."
docker compose -p $COMPOSE_PROJECT -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker compose up failed. Inspect the output above."
    Write-Warn2 "If the error mentions vm.max_map_count, re-run once after:"
    Write-Warn2 "  wsl --shutdown    (then start Docker Desktop again)"
    exit 1
}

# ---------------------------------------------------------------------------
# 5. Attach to the 'kind' Docker network when it exists, so the Jenkins
#    container and scanner containers can resolve http://sonarqube:9000.
#    Done here (not in the compose file) so the file also works with no kind.
# ---------------------------------------------------------------------------
Write-Step "Wiring up Docker networks..."
$networks = @(docker network ls --format "{{.Name}}")
if ($networks -contains "kind") {
    $attached = docker inspect -f "{{json .NetworkSettings.Networks.kind}}" pde-sonar 2>$null
    if (-not $attached -or $attached -eq "null") {
        docker network connect kind pde-sonar 2>$null | Out-Null
        Write-Ok "pde-sonar attached to the 'kind' network (alias: sonarqube)"
    } else {
        Write-Ok "pde-sonar already on the 'kind' network"
    }
} else {
    Write-Warn2 "Docker network 'kind' not found - skipping attach."
    Write-Warn2 "Re-run this script after the kind cluster exists if you want Jenkins"
    Write-Warn2 "to reach http://sonarqube:9000."
}

# ---------------------------------------------------------------------------
# 6. Poll the API until the server is UP (first boot runs DB migration and
#    builds the Elasticsearch index - expect 2-5 minutes on a 6 GB VM)
# ---------------------------------------------------------------------------
Write-Step "Waiting for SonarQube to report UP (timeout $BOOT_TIMEOUT_MIN min)..."
$deadline = (Get-Date).AddMinutes($BOOT_TIMEOUT_MIN)
$status   = "unreachable"
while ((Get-Date) -lt $deadline) {
    try {
        $resp   = Invoke-RestMethod -Uri "http://localhost:9000/api/system/status" -TimeoutSec 5 -ErrorAction Stop
        $status = $resp.status
    } catch {
        $status = "unreachable"
    }
    if ($status -eq "UP") { break }
    Write-Host ("  status = {0}   ({1:HH:mm:ss})" -f $status, (Get-Date))
    Start-Sleep -Seconds 10
}

if ($status -ne "UP") {
    Write-Err "SonarQube did not reach UP within $BOOT_TIMEOUT_MIN minutes (last status: $status)."
    Write-Warn2 "Diagnose with:"
    Write-Warn2 "  docker logs --tail 200 pde-sonar"
    Write-Warn2 "  docker logs --tail 100 pde-sonar-db"
    Write-Warn2 "Most common cause: vm.max_map_count below 524288 (Elasticsearch bootstrap)."
    Write-Warn2 "See sonar/SONARQUBE.md -> Troubleshooting."
    exit 1
}
Write-Ok "SonarQube is UP."

# ---------------------------------------------------------------------------
# 7. Memory report + next steps
# ---------------------------------------------------------------------------
Write-Step "Memory footprint (pde-sonar cap is 3.5 GiB; expect ~2.4 GiB in use):"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" pde-sonar pde-sonar-db

$oom = docker inspect pde-sonar --format "{{.State.OOMKilled}}" 2>$null
if ($oom -eq "true") {
    Write-Err "WARNING: pde-sonar reports OOMKilled=true - raise mem_limit or free memory."
}

Write-Host ""
Write-Ok "==============================================================================="
Write-Ok "  SonarQube is running - Mode E (kind must stay stopped)"
Write-Ok "==============================================================================="
Write-Host "  URL         : http://localhost:9000"
Write-Host "  First login : admin / admin   (it forces a password change immediately)"
Write-Host "  Compose     : project 'pde-sonar'"
Write-Host ""
Write-Host "  ONE-TIME SETUP (in the UI)"
Write-Host "    1. Change the admin password."
Write-Host "    2. Create project -> Manually -> Project key: pde"
Write-Host "    3. Generate a token (My Account -> Security -> Generate Token)"
Write-Host "    4. Store it in Jenkins as a 'Secret text' credential with id: sonar-token"
Write-Host ""
Write-Host "  THEN SCAN (run from the repo root, while the stack is up)"
Write-Host "    docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 -e SONAR_TOKEN=<token> -v `"`${PWD}:/usr/src`" sonarsource/sonar-scanner-cli"
Write-Host ""
Write-Host "  WHEN FINISHED"
Write-Host "    powershell -File sonar\scripts\stop-sonar.ps1"
Write-Host "    powershell -File local-k8s\scripts\restart-stack.ps1"
Write-Ok "==============================================================================="
