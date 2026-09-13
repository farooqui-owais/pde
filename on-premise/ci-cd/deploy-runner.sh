#!/usr/bin/env bash
# =============================================================================
# DakhalNama / PDE — CI/CD Runner Deployment Hook
# Invoked by GitHub Actions Self-Hosted Runner, Jenkins, or GitLab CI
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREMISE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [CI/CD Runner] Initiating On-Premise Deployment ==="
cd "${ONPREMISE_DIR}"

# Run deploy script
bash "${ONPREMISE_DIR}/scripts/deploy.sh"

echo "=== [CI/CD Runner] On-Premise Deployment Finished Successfully ==="
