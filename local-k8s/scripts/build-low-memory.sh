#!/bin/sh
# =============================================================================
# PDE — low-memory local image build (called by local-k8s/Jenkinsfile.k8s
# Stage 4 "Build & Push Images"; also usable standalone).
#
# WHY THIS SCRIPT EXISTS (6 GB Docker Desktop budget):
#   - Builds run strictly SEQUENTIALLY (backend, then frontend) so BuildKit
#     never executes two build graphs at once.
#   - The frontend Vite build gets a Node heap cap via a build-arg
#     (pde-frontend/Dockerfile.prod forwards NODE_OPTIONS into its build
#     stage). Node heap != container cap, but it keeps the heap bounded.
#   - No --pull / --no-cache: cached layers keep peak memory + time down.
#     (Disk cleanup, if ever needed: `docker builder prune -f`.
#      Do NOT use `docker system prune` as a RAM-management tool.)
#
# REQUIRED ENV (Jenkins sets both):
#   REGISTRY   e.g. localhost:5000
#   IMAGE_TAG  e.g. dev  or  42-a1b2c3d
#
# LOCAL USE (PowerShell, from repo root — use Git Bash, NOT WSL bash:
# WSL cannot see C:\ paths):
#   $env:REGISTRY='localhost:5000'; $env:IMAGE_TAG='dev'
#   & 'C:\Program Files\Git\bin\bash.exe' local-k8s/scripts/build-low-memory.sh
# =============================================================================
set -eu

: "${REGISTRY:?REGISTRY must be set (e.g. localhost:5000)}"
: "${IMAGE_TAG:?IMAGE_TAG must be set (e.g. dev)}"
NODE_HEAP_MB="${NODE_HEAP_MB:-768}"

echo "=== [1/4] Building backend image (sequential, low-memory) ==="
docker build -t "${REGISTRY}/pde/backend:${IMAGE_TAG}" pde-backend

echo "=== [2/4] Pushing backend image to ${REGISTRY} ==="
docker push "${REGISTRY}/pde/backend:${IMAGE_TAG}"

echo "=== [3/4] Building frontend image (Vite heap capped at ${NODE_HEAP_MB}MB) ==="
docker build \
  -f pde-frontend/Dockerfile.prod \
  --build-arg NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}" \
  -t "${REGISTRY}/pde/frontend:${IMAGE_TAG}" \
  pde-frontend

echo "=== [4/4] Pushing frontend image to ${REGISTRY} ==="
docker push "${REGISTRY}/pde/frontend:${IMAGE_TAG}"

echo "=== Done: ${REGISTRY}/pde/backend:${IMAGE_TAG} + ${REGISTRY}/pde/frontend:${IMAGE_TAG} ==="
