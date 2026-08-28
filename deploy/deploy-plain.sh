#!/usr/bin/env bash
# =============================================================================
# deploy-plain.sh - Plain deploy of the PDE (DakhalNama) app on ONE EC2 instance.
#
# No Docker. No Kubernetes. No RDS. No CloudFormation. Just:
#   PostgreSQL  +  FastAPI (gunicorn)  +  React (built to static)  +  nginx
# all on a single free-tier instance (t3.micro / t2.micro).
#
# Run ON the instance (Amazon Linux 2023; Ubuntu is auto-detected):
#   sudo bash deploy-plain.sh
#
# Optional env vars (set before running if you need them):
#   REPO_URL    the git repo. For a PRIVATE repo use a token URL:
#               https://<TOKEN>@github.com/farooqui-owais/pde.git
#   SECRET       JWT secret (>=32 chars); auto-generated if empty
#   DB_PASS      database password; default PdeDbPass2025x (change it!)
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------- settings ---
REPO_URL="${REPO_URL:-https://github.com/farooqui-owais/pde.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="/opt/pde"
SECRET="${SECRET:-}"
DB_NAME="${DB_NAME:-pde}"
DB_USER="${DB_USER:-pde_user}"
DB_PASS="${DB_PASS:-PdeDbPass2025x}"

echo "==> 1/9 detect OS"
if command -v dnf >/dev/null 2>&1; then
  PKG_MGR=dnf
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR=yum
elif command -v apt-get >/dev/null 2>&1; then
  PKG_MGR=apt
else
  echo "ERROR: unsupported OS" >&2; exit 1
fi
echo "    package manager: $PKG_MGR"

# Never prompt for git credentials - fail fast instead of hanging.
export GIT_TERMINAL_PROMPT=0

# ---------------------------------------------------------------- packages ---
echo "==> 2/9 system packages"
case "$PKG_MGR" in
  dnf|yum)
    sudo "$PKG_MGR" -y install postgresql-server postgresql python3 python3-pip gcc git nginx curl
    sudo "$PKG_MGR" groupinstall -y "Development Tools" >/dev/null 2>&1 || true
    ;;
  apt)
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
      postgresql postgresql-contrib python3 python3-pip python3-venv gcc git nginx curl libpq-dev
    ;;
esac

# Node 20 (frontend build-time only)
if ! command -v node >/dev/null 2>&1; then
  case "$PKG_MGR" in
    dnf|yum) curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - || true; sudo "$PKG_MGR" -y install nodejs || true ;;
    apt)     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - || true; sudo apt-get install -y nodejs || true ;;
  esac
fi
node -v 2>/dev/null || true

# ------------------------------------------------------- source code ---------
echo "==> 3/9 fetch source ($REPO_URL @ $REPO_BRANCH)"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR" 2>/dev/null || true
cd "$APP_DIR"
if [ -d pde/.git ]; then
  (cd pde && git fetch --all && git checkout "$REPO_BRANCH" && git pull --ff-only)
else
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" pde
fi
if [ ! -d pde/pde-backend ] || [ ! -d pde/pde-frontend ]; then
  echo "ERROR: repo cloned but pde-backend/pde-frontend not found (REPO_URL wrong?)." >&2
  echo "  For a PRIVATE repo use:  sudo REPO_URL=https://<TOKEN>@github.com/you/pde.git bash deploy-plain.sh" >&2
  exit 1
fi

# ------------------------------------------------------------ database -------
echo "==> 4/9 initialize local PostgreSQL"
if [ ! -f /var/lib/pgsql/data/PG_VERSION ] && command -v postgresql-setup >/dev/null 2>&1; then
  sudo postgresql-setup --initdb || true
fi
sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null

# ------------------------------------------------------------ backend venv ---
echo "==> 5/9 python venv + deps"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/pde/pde-backend/requirements.txt"

# -------------------------------------------------------------- frontend -----
echo "==> 6/9 build frontend (same-origin /api via nginx)"
cd "$APP_DIR/pde/pde-frontend"
export VITE_API_BASE_URL=/
npm ci
npm run build

# ------------------------------------------------------------------ .env -----
echo "==> 7/9 secrets + backend .env"
if [ -z "$SECRET" ]; then
  SECRET=$("$APP_DIR/venv/bin/python" -c "import secrets,sys;sys.stdout.write(secrets.token_urlsafe(48))")
fi
sudo tee "$APP_DIR/pde/pde-backend/.env" >/dev/null <<EOF
DEBUG=False
APP_VERSION=1.0.0
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
SECRET_KEY=${SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=X-CSRF-Token
CSRF_COOKIE_SECURE=False
CSRF_COOKIE_SAMESITE=lax
TRUSTED_HOSTS=*
RATE_LIMIT_MAX=8
RATE_LIMIT_WINDOW_SECONDS=60
EOF

# ------------------------------------------------------------ run -------------
echo "==> 8/9 systemd service + nginx"
UNIT_USER=${SUDO_USER:-$(id -un)}

sudo tee /etc/systemd/system/pde-api.service >/dev/null <<EOF
[Unit]
Description=PDE API (FastAPI / gunicorn)
After=network-online.target postgresql.service
Wants=network-online.target
[Service]
Type=simple
User=${UNIT_USER}
WorkingDirectory=$APP_DIR/pde/pde-backend
EnvironmentFile=$APP_DIR/pde/pde-backend/.env
ExecStart=$APP_DIR/venv/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/nginx/conf.d/pde.conf >/dev/null <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  root /opt/pde/pde/pde-frontend/dist;
  index index.html;
  client_max_body_size 20m;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
  location / { try_files $uri $uri/ /index.html; }
}
NGINX
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now pde-api
sudo systemctl enable --now nginx
sudo systemctl restart nginx

# ------------------------------------------------------------ health ----------
echo "==> 9/9 health check"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "API healthy after $i attempts"; break
  fi
  sleep 5
done

echo ""
echo "Plain deploy complete. Open http://<THIS_IP>/"
echo "  backend logs: sudo journalctl -u pde-api -f"
echo "  api health:   curl http://<THIS_IP>/api/health"