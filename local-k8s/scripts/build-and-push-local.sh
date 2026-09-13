#!/usr/bin/env bash
# =============================================================================
# Builds both images and pushes them to the local kind registry.
# Same steps Jenkins runs — useful for a quick manual iteration loop without
# going through a full pipeline run.
#
# Usage:
#   ./build-and-push-local.sh [tag]        # defaults to git short sha, else "dev"
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="localhost:5000"
TAG="${1:-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo dev)}"

echo "Building images with tag: ${TAG}"

docker build -t "${REGISTRY}/pde/backend:${TAG}" "${ROOT_DIR}/pde-backend"
docker push "${REGISTRY}/pde/backend:${TAG}"

docker build -f "${ROOT_DIR}/pde-frontend/Dockerfile.prod" \
  -t "${REGISTRY}/pde/frontend:${TAG}" "${ROOT_DIR}/pde-frontend"
docker push "${REGISTRY}/pde/frontend:${TAG}"

echo ""
echo "Pushed:"
echo "  ${REGISTRY}/pde/backend:${TAG}"
echo "  ${REGISTRY}/pde/frontend:${TAG}"
echo ""
echo "Now update helm/pde/values-local.yaml (backend.image.tag / frontend.image.tag)"
echo "to '${TAG}' and let ArgoCD sync, or run:"
echo "  helm upgrade --install pde ./helm/pde -n pde -f helm/pde/values-local.yaml \\"
echo "    --set backend.image.tag=${TAG} --set frontend.image.tag=${TAG}"
