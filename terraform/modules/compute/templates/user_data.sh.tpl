#!/bin/bash -xe
# PDE bootstrap - Amazon Linux 2023 (hardened + free-tier aware)
# Full log: cat /var/log/user-data.log
exec > >(tee /var/log/user-data.log) 2>&1
set -e

# Never prompt for git credentials - fail fast + log instead of hanging.
export GIT_TERMINAL_PROMPT=0

echo "==> system packages"
dnf -y update
dnf -y install nginx git python3.11 python3.11-pip gcc python3.11-devel \
  libpq-devel curl tar gzip cronie

# AWS CLI is needed to fetch secrets from SSM. AL2023 may not ship an
# `awscli` dnf package -> fall back to the official v2 bundle.
if ! command -v aws >/dev/null 2>&1; then
  dnf -y install awscli || true
fi
if ! command -v aws >/dev/null 2>&1; then
  echo "==> installing AWS CLI v2 (no awscli dnf package available)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp/awscliv2
  /tmp/awscliv2/aws/install
  rm -rf /tmp/awscliv2 /tmp/awscliv2.zip
fi

echo "==> Node 20 (build-time only)"
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || true
dnf -y install nodejs || true
node -v; npm -v

echo "==> fetch app (${repo_url} @ ${repo_branch})"
mkdir -p ${app_dir}
cd ${app_dir}
fetch_app() {
  if [ -d pde/.git ]; then
    (cd pde && git fetch --all && git checkout ${repo_branch} && git pull)
  else
    git clone --branch ${repo_branch} --depth 1 "$1" ${app_dir}/pde
  fi
}
if fetch_app "${repo_url}"; then
  : # ok
else
  # Redact any token embedded in the URL before printing it to the log.
  SAFE_URL=$(printf '%s' "${repo_url}" | sed -E 's#//[^@/]*@#//***@#')
  echo "ERROR: could not fetch repo ($SAFE_URL)." >&2
  echo "The repo is PRIVATE - redeploy passing" >&2
  echo "  repo_url=https://GITHUB_TOKEN@github.com/farooqui-owais/pde.git" >&2
  echo "(keep the token out of terraform.tfvars; see terraform/README.md 'Private Git repo')." >&2
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

# ---- python env + backend deps ----
python3.11 -m venv ${app_dir}/venv
${app_dir}/venv/bin/pip install --upgrade pip
${app_dir}/venv/bin/pip install -r ${app_dir}/pde/pde-backend/requirements.txt

# ---- build frontend (same-origin /api via nginx) ----
cd ${app_dir}/pde/pde-frontend
export VITE_API_BASE_URL=/
npm ci
npm run build

# ---- secrets from SSM Parameter Store (free, encrypted, no plaintext) ----
DB_PASSWORD=$(aws ssm get-parameter --name "${db_password_ssm_name}" \
  --with-decryption --query Parameter.Value --output text \
  --region ${aws_region})
SECRET=$(aws ssm get-parameter --name "${jwt_secret_ssm_name}" \
  --with-decryption --query Parameter.Value --output text \
  --region ${aws_region})

# ---- backend .env ----
# Secure cookies only make sense behind HTTPS (custom domain/CDN).
DOMAIN="${app_domain}"
if [ -n "$DOMAIN" ]; then
  CSRF_SECURE=True
else
  CSRF_SECURE=False
fi
cat > ${app_dir}/pde/pde-backend/.env <<EOF
DEBUG=False
APP_VERSION=1.0.0
DATABASE_URL=postgresql://${db_user}:$DB_PASSWORD@${db_host}:${db_port}/${db_name}
SECRET_KEY=$SECRET
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
CORS_ORIGINS=${cors_origins}
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=X-CSRF-Token
CSRF_COOKIE_SECURE=$CSRF_SECURE
CSRF_COOKIE_SAMESITE=lax
TRUSTED_HOSTS=${trusted_hosts}
RATE_LIMIT_MAX=8
RATE_LIMIT_WINDOW_SECONDS=60
EOF
chmod 600 ${app_dir}/pde/pde-backend/.env

# ---- systemd unit: API ----
cat > /etc/systemd/system/pde-api.service <<EOF
[Unit]
Description=PDE API (FastAPI)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
WorkingDirectory=${app_dir}/pde/pde-backend
EnvironmentFile=${app_dir}/pde/pde-backend/.env
ExecStart=${app_dir}/venv/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

# ---- wait for RDS (it can lag the instance) before starting the API ----
set -a
. ${app_dir}/pde/pde-backend/.env
set +a
echo "==> wait for database"
${app_dir}/venv/bin/python - <<'PY'
import os, socket, time
url = os.environ.get("DATABASE_URL", "")
host, port = "localhost", 5432
if "@" in url:
    hp = url.split("@", 1)[1].split("/")[0]
    host, _, port_s = hp.rpartition(":")
    port = int(port_s or 5432)
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

echo "==> start API + nginx"
systemctl enable --now pde-api

# ---- nginx: SPA + /api proxy (quoted heredoc keeps nginx vars) ----
cat > /etc/nginx/conf.d/pde.conf <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  root ${app_dir}/pde/pde-frontend/dist;
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
  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX
rm -f /etc/nginx/conf.d/default.conf
nginx -t
systemctl enable --now nginx
systemctl restart nginx

echo "==> wait for API health"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "API is healthy after $i attempts"
    break
  fi
  sleep 5
done

echo "PDE bootstrap complete"
curl -fsS http://127.0.0.1:8000/api/health && echo
