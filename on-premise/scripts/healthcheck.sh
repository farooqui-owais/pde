#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — On-Premise Healthcheck & Verification Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREMISE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ONPREMISE_DIR}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

HTTP_PORT="${HTTP_PORT:-80}"
BASE_URL="http://localhost:${HTTP_PORT}"
EXIT_CODE=0

echo "Running On-Premise Health Verification against ${BASE_URL}..."

# 1. Reverse Proxy Health
echo -n "Checking central proxy (/healthz)... "
if curl -sf "${BASE_URL}/healthz" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  EXIT_CODE=1
fi

# 2. Backend Health API
echo -n "Checking backend health (/api/health)... "
API_HEALTH=$(curl -s "${BASE_URL}/api/health" || echo "")
if echo "$API_HEALTH" | grep -q '"status":"ok"'; then
  echo "OK (${API_HEALTH})"
else
  echo "FAILED (${API_HEALTH})"
  EXIT_CODE=1
fi

# 3. Database Connectivity through Backend
echo -n "Checking database query via API (/api/reference/districts)... "
DB_CHECK=$(curl -s "${BASE_URL}/api/reference/districts" || echo "")
if echo "$DB_CHECK" | grep -q '\['; then
  echo "OK (Data retrieved successfully)"
else
  echo "FAILED (${DB_CHECK})"
  EXIT_CODE=1
fi

# 4. Frontend SPA Serving
echo -n "Checking frontend SPA delivery (/)... "
FRONTEND_HTML=$(curl -s "${BASE_URL}/" || echo "")
if echo "$FRONTEND_HTML" | grep -iq '<html'; then
  echo "OK"
else
  echo "FAILED"
  EXIT_CODE=1
fi

# 5. Container Status Check
echo "Checking Docker container statuses:"
docker ps --filter "name=pde-onpremise" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

if [ $EXIT_CODE -eq 0 ]; then
  echo "All on-premise components are HEALTHY."
else
  echo "WARNING: One or more health checks failed." >&2
fi

exit $EXIT_CODE
