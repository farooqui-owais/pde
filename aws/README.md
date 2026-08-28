# PDE — AWS Deployment (free tier)

Complete CloudFormation infrastructure for the **DakhalNama / PDE** app
(FastAPI + React + PostgreSQL). One template builds everything, and the EC2
bootstrap builds + runs the application automatically.

```
┌──────────────────────────────  AWS  ──────────────────────────────┐
│                                                                   │
│  VPC 10.0.0.0/16                                                 │
│  ┌───────────────────────────────────┐  ┌───────────────────────┐ │
│  │ PUBLIC subnet 10.0.1.0/24         │  │ PRIVATE subnet        │ │
│  │  EC2  t3.micro  (Amazon Linux)    │  │  10.0.2.0/24          │ │
│  │   ┌────────────────────────────┐  │  │  RDS PostgreSQL       │ │
│  │   │ Nginx  (SPA + /api proxy)  │  │  │  db.t3.micro / 20GB   │ │
│  │   │ Gunicorn → FastAPI :8000   │  │  │  (no internet access) │ │
│  │   └────────────────────────────┘  │  └───────────▲───────────┘ │
│  │  EIP (stable origin)  IAM role     │              │ 5432       │
│  └───────────────────▲───────────────┘              │(SG only)    │
│                      │ IGW                           │            │
│  CloudFront/CDN + ACM (optional)  <──── HTTPS ───────┴───> SG     │
│  Route 53 (optional)                                    Web->DB   │
│  S3 bucket (encrypted, versioned)  +  CloudWatch + SNS            │
└───────────────────────────────────────────────────────────────────┘
```

## What each file does

| File | Purpose |
| --- | --- |
| `infrastructure.yaml` | **The whole stack** — VPC, subnets, SGs, EC2 + user-data, RDS, S3, optional CloudFront/Route 53, CloudWatch + SNS, outputs. |
| `parameters/dev.json` | Values for the `aws cloudformation deploy` parameter overrides. |
| `scripts/nginx-pde.conf` | Standalone Nginx site (SPA + `/api` reverse proxy). |
| `scripts/pde-api.service` | Standalone systemd unit for Gunicorn/Uvicorn. |
| `scripts/user-data.sh` | Standalone EC2 bootstrap (same as the inline `UserData`). |

## 1. One-time prerequisites

1. **AWS CLI** configured: `aws configure` (or set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).
2. **EC2 key pair** already created in your target region (for SSH), e.g. `pde-key`.
3. **Your app code in a Git repo** with `pde-backend/` and `pde-frontend/` at the root
   (public repo, or a private repo the instance can read — see "Private repo" below).
4. (Optional) A **domain** and an **ACM certificate in `us-east-1`** for HTTPS/CDN.
5. (Optional) A **secrets generator**: `python -c "import secrets;print(secrets.token_urlsafe(64))"`.

## 2. Edit parameters

Edit `parameters/dev.json` and replace every `REPLACE_WITH_...`:

- `KeyPairName` — your existing key pair name.
- `RepoUrl`, `RepoBranch` — your repo. **`pde` is a private repo**; a bare
  `https://github.com/...` or `git@github.com:...` clone will fail on a fresh
  EC2 instance (no credentials). Pass a token-bearing URL **at deploy time only**
  (never commit it): `RepoUrl=https://<GITHUB_TOKEN>@github.com/you/pde.git`.
- `DBPassword` — letters+digits only (≥12 chars) so it is safe inside `.env`.
- `SecretKey` — a long random string (≥32 chars).
- `AlertEmail` — where alarms go. Leave the whole entry out / empty to skip SNS.
- `SshIngressCidr` — restrict to your IP (`1.2.3.4/32`) for production.

## 3. Deploy

```bash
cd aws

aws cloudformation deploy \
  --stack-name pde-infra \
  --template-file infrastructure.yaml \
  --parameter-overrides file://parameters/dev.json \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1
```

Wait 10–15 minutes (user-data installs Node, Python, clones the repo, builds the
frontend, writes `.env`, and starts `pde-api` + `nginx`).

Check status:

```bash
aws cloudformation describe-stacks \
  --stack-name pde-infra --region ap-south-1 \
  --query "Stacks[0].Outputs"
```

Then open the app:

```bash
open "$(aws cloudformation describe-stacks --stack-name pde-infra --region ap-south-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`AppHttpUrl`].OutputValue' --output text)"
```

Health check: `curl <public-ip>/api/health` → `{"status":"ok",...}`

The API auto-creates its tables and seeds reference data on first start, so
nothing else is required before registering a user.
## 4. SSH / troubleshooting

```bash
ssh -i <your-key.pem> ec2-user@<PublicIp>
tail -f /var/log/user-data.log   # bootstrap log
sudo journalctl -u pde-api -f    # app logs
sudo systemctl status nginx      # web server
curl -s http://127.0.0.1:8000/api/health
```

| Symptom | Likely fix |
| --- | --- |
| Bootstrap aborted early (log says `ERROR: could not fetch repo`) | Private repo — redeploy with `RepoUrl=https://<GITHUB_TOKEN>@github.com/you/pde.git`. |
| `502 Bad Gateway` | `pde-api` crashed — `sudo systemctl status pde-api`, check `journalctl`. |
| CSRF / login fails over plain HTTP | No custom domain ⇒ `CSRF_COOKIE_SECURE=False` is set automatically. Re-deploy after adding a domain to switch to `True`. |
| Blank / 404 on refresh | Nginx SPA fallback not applied — confirm `try_files ... /index.html` in `/etc/nginx/conf.d/pde.conf`. |
| CORS errors in console | Add the exact origin to `CorsOrigins` and redeploy. |

## 5. Free-tier cost notes

Stays inside the **AWS 12-month free tier** (new account):

- **EC2** `t3.micro` — 750 h/mo free. ✔
- **RDS** `db.t3.micro` single-AZ + 20 GB + 20 GB backups — free. ✔
- **S3** 5 GB — free. ✔  **CloudFront** 1 TB out + 10 M requests — free. ✔
- **CloudWatch** 10 metrics, 5 alarms, 1 GB logs — free. **SNS** 1 M requests — free.
- **ACM** public certs — free. **EIP** — free while attached. ✔

Deliberately **not** used (they would bill you): NAT Gateway, Application Load
Balancer, detached EIPs, Multi-AZ RDS. The DB lives in a private subnet with a
private route table so it needs **no NAT**.

Free-tier guardrails baked into the template:
- EC2 `Monitoring` is off (standard CloudWatch metrics, not billed detail monitoring).
- RDS `MaxAllocatedStorage` is capped at 20 GB (no paid storage autoscaling).
- EIP is attached to the instance (free only while attached, never idled/detached).

> After the 12-month free tier you'll be billed. Rough ongoing estimate
> (ap-south-1, on-demand, single instance + DB): **~$14–20/mo**. Use a Savings
> Plan / Reserved instance and shut down when idle to cut it.

## 6. Add HTTPS + a custom domain (recommended for production)

1. Request an ACM cert for `app.example.com` in **us-east-1** and wait for it to
   become `issued`.
2. Set `AppDomain=app.example.com`, `AcmCertificateArn=<arn>`,
   `CorsOrigins=https://app.example.com,http://localhost:5173,http://127.0.0.1:5173`,
   `TrustedHosts=app.example.com` in `dev.json`.
3. Redeploy:

```bash
aws cloudformation deploy --stack-name pde-infra \
  --template-file infrastructure.yaml \
  --parameter-overrides file://parameters/dev.json \
  --capabilities CAPABILITY_IAM --region ap-south-1
```

CloudFormation will create a CloudFront distribution + Route 53 hosted zone and
point `app.example.com` and `www.app.example.com` at it. If the domain is
registered elsewhere, add the four NS records from the new hosted zone at your
registrar.

## 7. Security hardening checklist (before real use)

- [ ] Set `SecretKey` and `DBPassword` to fresh random values (never reuse these).
- [ ] Restrict SSH in `WebServerSecurityGroup` to your IP (`CidrIp: <your-ip>/32`).
- [ ] Prefer Secrets Manager / SSM dynamic references for the two secrets
      (CloudFormation `W1011`) instead of parameter inputs.
- [ ] Use the custom-domain + HTTPS path so `CSRF_COOKIE_SECURE=True` applies.
- [ ] Replace the illustrative stamp-duty rate in `pde-backend/app/routers/documents.py`
      with the correct official schedule before production use (per README).
- [ ] Enable AWS WAF / Shield on the CloudFront distribution for public workloads.
- [ ] Keep `DEBUG=False` (set in `.env` by the bootstrap).
- [ ] Create RDS snapshots and test the S3 `ArtifactBucket` backup path.

## 8. Update / destroy

Update (redeploy with changed params or template):

```bash
aws cloudformation deploy --stack-name pde-infra \
  --template-file infrastructure.yaml \
  --parameter-overrides file://parameters/dev.json \
  --capabilities CAPABILITY_IAM --region ap-south-1
```

Push new code to the repo branch, then on the instance:

```bash
cd /opt/pde/pde && git pull && sudo systemctl restart pde-api
```

Delete everything (the S3 bucket is `Retain`ed by design):

```bash
aws cloudformation delete-stack --stack-name pde-infra --region ap-south-1
```

> The `ArtifactBucket` uses `DeletionPolicy: Retain` — you must empty/delete it
> manually if you want it gone too.

## 9. Private Git repository

The instance needs your repo. For a private repo:

1. Create a read-only **GitHub Deploy Key** or a **personal access token**.
2. Embed it in `RepoUrl`, e.g. `https://TOKEN@github.com/you/pde.git`, OR
   store the key in SSM (free) and have user-data fetch it:
   `aws ssm get-parameter --name /pde/git-token --with-decryption --query Parameter.Value`
   (add `ssm:GetParameters` to `Ec2Role` first).
3. Keep it out of `dev.json` — pass it at deploy time only.


Wait ~10–15 min, then health-check `http://<PublicIp>/api/health`.

Note: I can't run the actual `aws` deploy from this environment (no AWS credentials), so validation was done with `cfn-lint` + a YAML/JSON parse. Before going live, generate a real secret with `python -c "import secrets;print(secrets.token_urlsafe(64))"` and replace the placeholders.
