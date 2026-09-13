# DakhalNama / PDE — On-Premise Production Deployment & CI/CD Guide

This directory contains the production-grade deployment stack, operational utilities, and CI/CD pipelines for deploying DakhalNama / PDE on an **on-premise server, virtual machine (VM), or intranet data center**.

---

## 1. Topology & Architecture

```
                                [Client Browser / Intranet]
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │    Central Ingress Nginx      │
                             │  (Port 80 / 443 SSL / TLS)    │
                             └───────────────┬───────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      │                                             │
               Path: /api/*, /docs, /redoc                   Path: /* (All UI routes)
                      │                                             │
                      ▼                                             ▼
       ┌───────────────────────────────┐             ┌───────────────────────────────┐
       │     pde-onpremise-backend     │             │    pde-onpremise-frontend     │
       │       (FastAPI + Gunicorn)    │             │      (React 18 + Vite SPA)    │
       │           Port: 8000          │             │           Port: 80            │
       └──────────────┬────────────────┘             └───────────────────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │       pde-onpremise-db        │
       │     (PostgreSQL 16 Alpine)    │
       │  Volume: onpremise_pgdata     │
       └───────────────────────────────┘
```

### Components

| Service | Technology | Description |
| :--- | :--- | :--- |
| **`proxy`** | Nginx 1.27 Alpine | Central reverse proxy, routing, SSL/TLS termination, request size limit (50MB), security headers. |
| **`backend`** | FastAPI + Python 3.11 + Gunicorn | API service running with multi-worker Uvicorn, automated schema migration & reference seeding. |
| **`frontend`** | React 18 + Vite + Nginx | SPA client built with production optimizations and client-side route fallback. |
| **`db`** | PostgreSQL 16 Alpine | Primary transactional relational database with persistent named Docker volume. |

---

## 2. Server Prerequisites

- **Operating System:** Ubuntu 22.04/24.04 LTS, Debian 12, RHEL 8/9, Rocky Linux 9, or Amazon Linux 2023.
- **Hardware:** Minimum 2 vCPUs, 4 GB RAM, 30 GB SSD.
- **Network Ports:** Port `80` (HTTP) and `443` (HTTPS) accessible to clients.
- **Required Software:**
  - Docker Engine (`>= 24.0`)
  - Docker Compose (`>= 2.20` plugin `docker compose`)

### Installing Docker (Ubuntu/Debian example)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Quick Start (Manual Setup)

### Step 1: Clone Repository
```bash
git clone <your-repository-url> /opt/pde
cd /opt/pde/on-premise
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` and configure your settings:
```bash
cp .env.example .env
```
Generate a secure random key for `SECRET_KEY`:
```bash
openssl rand -base64 32
```
Edit `.env` using your favorite text editor:
```bash
nano .env
```
Ensure you change:
- `SECRET_KEY`: Your generated secret key.
- `POSTGRES_PASSWORD`: A strong password for PostgreSQL.
- `DOMAIN_NAME`: Your intranet hostname or IP (e.g. `pde.internal` or `192.168.1.50`).

### Step 3: Run Deployment Script
```bash
chmod +x scripts/*.sh ci-cd/*.sh
./scripts/deploy.sh
```
The script will:
1. Verify prerequisites.
2. Initialize environment settings.
3. Build production container images for backend and frontend.
4. Launch PostgreSQL, backend, frontend, and reverse proxy.
5. Wait for readiness and run complete health checks.

### Step 4: Verify Deployment
Open your browser at:
- **Application Portal:** `http://<server-ip>/`
- **Interactive API Docs:** `http://<server-ip>/docs`
- **Health Check:** `http://<server-ip>/api/health`

---

## 4. System Service (Autostart on Boot)

To ensure the on-premise stack starts automatically upon server reboot:

```bash
sudo cp /opt/pde/on-premise/systemd/pde-onpremise.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pde-onpremise.service
sudo systemctl start pde-onpremise.service
```

### Checking Status & Logs:
```bash
sudo systemctl status pde-onpremise.service
docker compose -f /opt/pde/on-premise/docker-compose.yml logs -f
```

---

## 5. CI/CD Pipelines for On-Premise

We provide multiple automated CI/CD options depending on your corporate infrastructure:

### Option A: GitHub Actions (via SSH)
See `.github/workflows/deploy-onpremise.yml`.
Configure the following secrets in GitHub Repository Settings -> Secrets and variables -> Actions:
- `ONPREMISE_HOST`: Public or VPN IP address of the on-premise server.
- `ONPREMISE_USER`: SSH username (e.g. `ubuntu` or `deploy`).
- `ONPREMISE_SSH_KEY`: Private SSH key authorized in `~/.ssh/authorized_keys` on the server.
- `ONPREMISE_PATH`: Path to the project (e.g. `/opt/pde`).

When code is merged to `main`, GitHub Actions connects over SSH and executes `on-premise/scripts/deploy.sh`.

### Option B: GitHub Actions (Self-Hosted Runner)
Install a GitHub Actions runner directly on your on-premise server:
1. Go to **Settings -> Actions -> Runners -> New self-hosted runner**.
2. Follow GitHub's instructions to configure and run `./run.sh`.
3. In `.github/workflows/deploy-onpremise.yml`, set `runs-on: self-hosted`.

### Option C: Enterprise Jenkins
A declarative `Jenkinsfile` is provided in `on-premise/ci-cd/Jenkinsfile`.
1. Create a "Pipeline" or "Multibranch Pipeline" job in Jenkins.
2. Point it to this repository.
3. Jenkins will execute linting, unit testing, automated deployment via `deploy.sh`, and health verification.

### Option D: On-Premise GitLab CI
A `.gitlab-ci.yml` file is provided in `on-premise/ci-cd/.gitlab-ci.yml`.
Simply tag your GitLab Shell runner with `onpremise-shell` to enable automated push-to-deploy.

---

## 6. Backup, Rotation & Disaster Recovery

### Automated Nightly Backups
To schedule automatic daily backups at 02:00 AM with automatic 14-day rotation:
```bash
crontab -e
```
Add the entry:
```cron
0 2 * * * /bin/bash /opt/pde/on-premise/scripts/backup-db.sh >> /var/log/pde-backup.log 2>&1
```

### Manual Backup
```bash
./scripts/backup-db.sh
```
Backups are saved to `on-premise/backups/pde_backup_<db>_<timestamp>.sql.gz` along with a SHA-256 checksum file.

### Restoring from Backup
```bash
./scripts/restore-db.sh ./backups/pde_backup_dakhalnama_20260912_120000.sql.gz
```

---

## 7. SSL / TLS Configuration

1. Generate or place your SSL certificate in `on-premise/nginx/ssl/`:
   - Certificate / CA bundle: `server.crt`
   - Private key: `server.key`

2. For intranet testing without a certificate authority:
   ```bash
   bash nginx/ssl/generate-self-signed.sh pde.internal
   ```

3. Update `nginx/nginx.conf` to add the HTTPS block (refer to `nginx/ssl/README.md`) and set:
   ```env
   CSRF_COOKIE_SECURE=True
   HTTPS_PORT=443
   ```

---

## 8. Air-Gapped / Offline Environments

For high-security networks without internet access:
1. **On an internet-connected workstation:**
   ```bash
   docker compose -f on-premise/docker-compose.yml build
   docker save postgres:16-alpine nginx:1.27-alpine pde-backend:latest pde-frontend:latest | gzip > pde-images.tar.gz
   ```
2. **Transfer `pde-images.tar.gz` and the repository to the target server via approved media.**
3. **On the air-gapped server:**
   ```bash
   docker load < pde-images.tar.gz
   ./scripts/deploy.sh --no-build
   ```

---

## 9. Troubleshooting & Operations

| Symptom | Probable Cause | Recommended Action |
| :--- | :--- | :--- |
| **502 Bad Gateway** | Backend container starting up or crashed | Run `docker compose logs backend` to inspect Python traceback. |
| **CORS Error in Browser** | Origin mismatch | Update `CORS_ORIGINS` in `.env` to match the exact protocol and host used in browser. |
| **Database Connection Refused** | PostgreSQL container not healthy | Run `docker compose logs db` and check disk space (`df -h`). |
| **CSRF Cookie Warning** | HTTP used while `CSRF_COOKIE_SECURE=True` | Set `CSRF_COOKIE_SECURE=False` in `.env` when serving over plain HTTP. |
| **Upload Rejected (413)** | Payload exceeds Nginx limit | Increase `client_max_body_size` in `nginx/nginx.conf`. |
