#!/usr/bin/env bash
# =============================================================================
# user-data.sh - Standalone bootstrap for the PDE (DakhalNama) app on an
# Amazon Linux 2023 EC2 instance (no CloudFormation).
#
# This mirrors the inline UserData used by infrastructure.yaml. You can reuse
# this exact script to install the app on a bare instance with:
#
#   aws ec2 run-instances \
#     --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
#     --instance-type t3.micro --key-name <keypair> \
#     --user-data file://scripts/user-data.sh \
#     --security-group-ids <websg-id> --subnet-id <public-subnet-id> \
#     --iam-instance-profile Name=<profile> --region ap-south-1
#
# Required env (export them first, or edit the defaults below):
#   APP_DIR / REPO_URL / REPO_BRANCH / DB_HOST / DB_PORT / DB_NAME / DB_USER /
#   DB_PASSWORD / CORS_ORIGINS / TRUSTED_HOSTS / SECRET_KEY / APP_DOMAIN
# =============================================================================
set -euo pipefail

# Never prompt for git credentials - fail fast + log instead of hanging.
export GIT_TERMINAL_PROMPT=0

APP_DIR="${APP_DIR:-/opt/pde}"
REPO_URL="${REPO_URL:-https://github.com/farooqui-owais/pde.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pde}"
DB_USER="${DB_USER:-pde_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
TRUSTED_HOSTS="${TRUSTED_HOSTS:-*}"
SECRET_KEY="${SECRET_KEY:-}"
APP_DOMAIN="${APP_DOMAIN:-}"

if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: DB_HOST and DB_PASSWORD must be set." >&2
  exit 2
fi

echo "==> system packages"
sudo dnf -y update
sudo dnf -y install nginx git python3.11 python3.11-pip gcc python3.11-devel \
  libpq-devel curl tar gzip cronie
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - || true
sudo dnf -y install nodejs || true

echo "==> fetch app ($REPO_URL @ $REPO_BRANCH)"
sudo mkdir -p "$APP_DIR"
sudo chown -R ec2-user:ec2-user "$APP_DIR"
cd "$APP_DIR"
fetch_app() {
  if [ -d "$APP_DIR/pde/.git" ]; then
    (cd "$APP_DIR/pde" && git fetch --all && git checkout "$REPO_BRANCH" && git pull)
  else
    git clone --branch "$REPO_BRANCH" --depth 1 "$1" "$APP_DIR/pde"
  fi
}
if ! fetch_app "$REPO_URL"; then
  # Redact any token embedded in the URL before printing it.
  SAFE_URL=$(printf '%s' "$REPO_URL" | sed -E 's#//[^@/]*@#//***@#')
  echo "ERROR: could not fetch repo ($SAFE_URL)." >&2
  echo "For a PRIVATE repo re-run with REPO_URL=https://GITHUB_TOKEN@github.com/you/pde.git" >&2
  exit 1
fi

# CI (GitHub Actions) triggers this file via SSM Run Command.
cat > /opt/pde/deploy-cd.sh <<'SCD'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/pde/pde
git fetch --all && git reset --hard && git pull --ff-only
/opt/pde/venv/bin/pip install -q -r pde-backend/requirements.txt
(cd pde-frontend && export VITE_API_BASE_URL=/ && npm ci && npm run build)
sudo systemctl restart pde-api
sudo systemctl restart nginx
curl -fsS http://127.0.0.1:8000/api/health || exit 1
SCD
chmod +x /opt/pde/deploy-cd.sh

echo "==> python env + backend deps"
python3.11 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/pde/pde-backend/requirements.txt"

echo "==> build frontend (same-origin /api via nginx)"
cd "$APP_DIR/pde/pde-frontend"
export VITE_API_BASE_URL=/
npm ci
npm run build

echo "==> JWT secret"
if [ -z "$SECRET_KEY" ]; then
  SECRET_KEY=$("$APP_DIR/venv/bin/python" -c "import secrets,sys;sys.stdout.write(secrets.token_urlsafe(48))")
fi

if [ -n "$APP_DOMAIN" ]; then CSRF_SECURE="True"; else CSRF_SECURE="False"; fi

echo "==> backend .env"
cat > "$APP_DIR/pde/pde-backend/.env" <<EOF
DEBUG=False
APP_VERSION=1.0.0
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
CORS_ORIGINS=${CORS_ORIGINS}
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=X-CSRF-Token
CSRF_COOKIE_SECURE=${CSRF_SECURE}
CSRF_COOKIE_SAMESITE=lax
TRUSTED_HOSTS=${TRUSTED_HOSTS}
RATE_LIMIT_MAX=8
RATE_LIMIT_WINDOW_SECONDS=60
EOF

echo "==> systemd unit"
sudo cp "$APP_DIR/../pde-api.service" /etc/systemd/system/pde-api.service 2>/dev/null || true
cat > /etc/systemd/system/pde-api.service <<EOF
[Unit]
Description=PDE API (FastAPI)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/pde/pde-backend
EnvironmentFile=$APP_DIR/pde/pde-backend/.env
ExecStart=$APP_DIR/venv/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload

echo "==> wait for database (RDS can lag the instance)"
"$APP_DIR/venv/bin/python" - "$DB_HOST" "$DB_PORT" <<'PY'
import socket, time, sys
host, port = sys.argv[1], int(sys.argv[2])
for _ in range(90):
    try:
        s = socket.create_connection((host, port), timeout=5)
        s.close()
        print(f"database reachable at {host}:{port}")
        break
    except OSError:
        time.sleep(5)
else:
    raise SystemExit(f"database not reachable at {host}:{port}")
PY

sudo systemctl enable --now pde-api

echo "==> nginx"
sudo cp /etc/nginx/conf.d/pde.conf /etc/nginx/conf.d/pde.conf.bak 2>/dev/null || true
sudo cp "$APP_DIR/../nginx-pde.conf" /etc/nginx/conf.d/pde.conf 2>/dev/null || true
cat > /etc/nginx/conf.d/pde.conf <<EOF
server {
  listen 80 default_server;
  server_name _;
  root $APP_DIR/pde/pde-frontend/dist;
  index index.html;
  client_max_body_size 20m;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60s;
    client_max_body_size 20m;
  }
  location / { try_files \$uri \$uri/ /index.html; }
}
EOF
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx

echo "==> wait for API health"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "API is healthy after $i attempts"
    break
  fi
  sleep 5
done

echo "PDE bootstrap complete. Health check:"
curl -fsS http://127.0.0.1:8000/api/health && echo