# Simple / Plain Deployment (no Docker, no Kubernetes)

One script installs and runs the whole app as plain services on a single server:

- **PostgreSQL** (local) + **FastAPI** via **gunicorn** (a systemd service) + **React**
  (built to static files) served by **nginx**.
- Works on a free-tier EC2 (`t3.micro` / `t2.micro`) with **Amazon Linux 2023** or Ubuntu.
- No Docker, no Kubernetes, no RDS, no CloudFormation, no extra AWS services.

## The only file you need

`deploy/deploy-plain.sh`

## Steps

1. **Launch one EC2 instance** in your AWS console:
   - AMI: Amazon Linux 2023 (or Ubuntu 22.04/24.04)
   - Type: `t3.micro` / `t2.micro` (free tier)
   - Security Group: allow **SSH (22)** from your IP and **HTTP (80)** from anywhere.
   - Attach a key pair so you can SSH in.

2. **Put the script on the box** (simplest = pin it from GitHub):
   ```bash
   sudo bash -c "curl -fsSLo /tmp/deploy.sh https://raw.githubusercontent.com/farooqui-owais/pde/main/deploy/deploy-plain.sh && bash /tmp/deploy.sh"
   ```
   Or `scp deploy/deploy-plain.sh ec2-user@<IP>:/tmp/` and run `sudo bash /tmp/deploy.sh`.

3. **If the repo is private**, pass a token URL (takes 1 command):
   ```bash
   sudo REPO_URL="https://<GITHUB_TOKEN>@github.com/farooqui-owais/pde.git" bash /tmp/deploy.sh
   ```

## Result

After ~5–10 minutes the script prints `Plain deploy complete`. Open:

- **App:** `http://<server-public-ip>/`
- **Health:** `http://<server-public-ip>/api/health` → `{"status":"ok",...}`

## Day-to-day

```bash
sudo journalctl -u pde-api -f      # backend logs
sudo systemctl restart pde-api     # restart backend
```

## What it does (9 steps)

`detect OS -> install packages -> pull source -> create local Postgres DB ->
python venv + deps -> build React -> write .env -> systemd + nginx -> health check`