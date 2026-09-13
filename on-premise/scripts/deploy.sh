#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — On-Premise Automated Deployment Script
# Usage:
#   ./deploy.sh [--skip-backup] [--no-build]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREMISE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${ONPREMISE_DIR}/.." && pwd)"

SKIP_BACKUP=false
NO_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --no-build)
      NO_BUILD=true
      shift
      ;;
    *)
      ;;
  esac
done

echo "=========================================================="
echo " Starting PDE On-Premise Deployment"
echo " Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Working Dir: ${ONPREMISE_DIR}"
echo "=========================================================="

cd "${ONPREMISE_DIR}"

# 1. Verify Prerequisites
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is not installed." >&2; exit 1; }
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "ERROR: Neither 'docker compose' nor 'docker-compose' found." >&2
  exit 1
fi

# 2. Check Environment file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Notice: .env not found. Copying .env.example to .env..."
    cp .env.example .env
    # Generate random secret key if still default
    RANDOM_KEY=$(openssl rand -base64 32 2>/dev/null || date +%s%N | sha256sum | head -c 32)
    sed -i "s|replace-with-a-very-secure-random-string-at-least-32-chars-long!|${RANDOM_KEY}|g" .env
  else
    echo "ERROR: .env file missing and .env.example not found." >&2
    exit 1
  fi
fi

# Load variables
set -a
# shellcheck disable=SC1091
source .env
set +a

# 3. Create pre-deployment backup if container is currently running
if [ "$SKIP_BACKUP" = false ]; then
  if docker ps --format '{{.Names}}' | grep -q "^pde-onpremise-db$"; then
    echo "[1/4] Creating safety backup of database prior to deployment..."
    bash "${SCRIPT_DIR}/backup-db.sh" || echo "Warning: Backup step reported an issue, continuing..."
  else
    echo "[1/4] Database container not currently active; skipping pre-deploy backup."
  fi
else
  echo "[1/4] Skipping pre-deploy backup (--skip-backup specified)."
fi

# 4. Build and Launch Containers
echo "[2/4] Deploying updated application stack..."
if [ "$NO_BUILD" = true ]; then
  ${DOCKER_COMPOSE} up -d --remove-orphans
else
  ${DOCKER_COMPOSE} up -d --build --remove-orphans
fi

# 5. Wait for Services and Verify Health
echo "[3/4] Performing health and readiness checks..."
MAX_ATTEMPTS=20
DELAY=3
PASSED=false

echo "Waiting for API to become healthy at http://localhost:${HTTP_PORT:-80}/api/health..."
for i in $(seq 1 $MAX_ATTEMPTS); do
  if curl -sf "http://localhost:${HTTP_PORT:-80}/api/health" >/dev/null 2>&1; then
    echo "API is healthy and responding (attempt $i)."
    PASSED=true
    break
  fi
  echo "Waiting for backend service... (attempt $i/$MAX_ATTEMPTS)"
  sleep $DELAY
done

if [ "$PASSED" = false ]; then
  echo "=========================================================="
  echo "ERROR: Health check failed after $MAX_ATTEMPTS attempts!" >&2
  echo "Fetching container logs for debugging:"
  ${DOCKER_COMPOSE} logs --tail=50 backend
  echo "=========================================================="
  echo "Deployment failed. Run './scripts/rollback.sh' to revert if needed."
  exit 1
fi

# 6. Full Integration Verification
echo "[4/4] Executing comprehensive smoke test..."
bash "${SCRIPT_DIR}/healthcheck.sh"

echo "=========================================================="
echo " PDE On-Premise Deployment Successfully Completed!"
echo " App URL:     http://localhost:${HTTP_PORT:-80}/"
echo " API Docs:    http://localhost:${HTTP_PORT:-80}/docs"
echo " Health API:  http://localhost:${HTTP_PORT:-80}/api/health"
echo "=========================================================="
