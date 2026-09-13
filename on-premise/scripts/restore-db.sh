#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — On-Premise Database Restore Script
# Restores a compressed SQL dump (.sql.gz) to the PostgreSQL container.
# Usage:
#   ./restore-db.sh <path-to-backup.sql.gz> [--force]
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

DB_CONTAINER="pde-onpremise-db"
DB_USER="${POSTGRES_USER:-dakhal_user}"
DB_NAME="${POSTGRES_DB:-dakhalnama}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz> [--force]"
  echo "Available backups in backups/:"
  ls -lh "${ONPREMISE_DIR}/backups"/*.sql.gz 2>/dev/null || echo "No backups found."
  exit 1
fi

BACKUP_FILE="$1"
FORCE=false
if [ "${2:-}" = "--force" ]; then
  FORCE=true
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file '${BACKUP_FILE}' not found." >&2
  exit 1
fi

if [ "$FORCE" = false ]; then
  echo "WARNING: Restoring will overwrite existing data in database '${DB_NAME}'!"
  read -rp "Are you sure you want to proceed? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore aborted by user."
    exit 0
  fi
fi

# Optional checksum verification
if [ -f "${BACKUP_FILE}.sha256" ] && command -v sha256sum >/dev/null 2>&1; then
  echo "Verifying SHA256 checksum..."
  sha256sum -c "${BACKUP_FILE}.sha256"
fi

echo "Creating safety pre-restore backup of current state..."
bash "${SCRIPT_DIR}/backup-db.sh" || echo "Warning: Pre-restore backup had warnings, continuing..."

echo "Restoring database '${DB_NAME}' from '${BACKUP_FILE}'..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "Database restore completed successfully. Verifying application health..."
bash "${SCRIPT_DIR}/healthcheck.sh"
