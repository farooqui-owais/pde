#!/usr/bin/env bash
# deploy.sh — build frontend, sync assets, upload backend, restart service,
# then health-check. Adjust paths/hosts to your environment.
set -euo pipefail

APP_DIR="/opt/pde"
VENV="$APP_DIR/venv"
BACKEND_SRC="$APP_DIR/pde-backend"
FRONTEND_SRC="$APP_DIR/pde-frontend"
DIST_DIR="$APP_DIR/frontend-dist"
SERVICE="pde-api"
API_HEALTH="http://127.0.0.1:8000/api/health"

echo "==> 1/5 Install backend dependencies"
"$VENV/bin/pip" install --upgrade -r "$BACKEND_SRC/requirements.txt"

echo "==> 2/5 Build frontend"
npm --prefix "$FRONTEND_SRC" ci
npm --prefix "$FRONTEND_SRC" run build

echo "==> 3/5 Sync frontend to storage/CDN"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cp -r "$FRONTEND_SRC"/dist/* "$DIST_DIR"/   # rsync to CDN/storage in production

echo "==> 4/5 Restart backend service"
sudo systemctl restart "$SERVICE"

echo "==> 5/5 Health check"
curl --fail --silent --show-error "$API_HEALTH" | head -c 200
echo ""
echo "Deploy complete."