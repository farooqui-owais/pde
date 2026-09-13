#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — On-Premise Automated Database Backup Script
# Creates a compressed pg_dump and manages retention rotation.
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

BACKUP_DIR="${ONPREMISE_DIR}/${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DB_CONTAINER="pde-onpremise-db"
DB_USER="${POSTGRES_USER:-dakhal_user}"
DB_NAME="${POSTGRES_DB:-dakhalnama}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="pde_backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "Starting PostgreSQL backup for database '${DB_NAME}'..."

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: Container '${DB_CONTAINER}' is not running." >&2
  exit 1
fi

# Execute pg_dump and stream to gzip
docker exec -t "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILEPATH}"

# Generate SHA256 checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${BACKUP_FILEPATH}" > "${BACKUP_FILEPATH}.sha256"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILEPATH}" | cut -f1)
echo "Backup successfully created: ${BACKUP_FILEPATH} (${BACKUP_SIZE})"

# Retention Rotation: Remove backups older than $RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "pde_backup_*.sql.gz*" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "Backup and rotation completed."
