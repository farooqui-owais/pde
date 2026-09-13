#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — On-Premise Rollback Script
# Reverts the application stack and optionally restores the latest backup.
# Usage:
#   ./rollback.sh [--restore-db]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREMISE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ONPREMISE_DIR}"

RESTORE_DB=false
if [ "${1:-}" = "--restore-db" ]; then
  RESTORE_DB=true
fi

echo "=========================================================="
echo " Initiating PDE On-Premise Rollback"
echo "=========================================================="

# 1. Stop current containers
echo "Restarting containers..."
docker compose down

# 2. Check if git repository to checkout previous commit
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git repository detected. Reverting to HEAD~1..."
  git checkout HEAD~1
fi

# 3. Bring previous version back up
echo "Launching containers from rollback commit..."
docker compose up -d --build

# 4. Optional Database Restore
if [ "$RESTORE_DB" = true ]; then
  LATEST_BACKUP=$(ls -t "${ONPREMISE_DIR}/backups"/*.sql.gz 2>/dev/null | head -n 1 || echo "")
  if [ -n "$LATEST_BACKUP" ]; then
    echo "Restoring database from latest backup: ${LATEST_BACKUP}..."
    bash "${SCRIPT_DIR}/restore-db.sh" "${LATEST_BACKUP}" --force
  else
    echo "Warning: No backup file found in backups/ to restore."
  fi
fi

# 5. Verify Health
bash "${SCRIPT_DIR}/healthcheck.sh"
echo "Rollback completed."
