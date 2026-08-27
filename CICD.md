# CI/CD Pipeline — DakhalNama / PDE on AWS Free Tier

End-to-end, start-to-finish guide for a **development → production** CI/CD
pipeline for the DakhalNama / PDE app (FastAPI + React/Vite + PostgreSQL),
designed to stay inside the **AWS Free Tier** and re-use the existing AWS
infrastructure in `aws/`.

Stack targeted: **GitHub** (repo) → **GitHub Actions** (CI/CD) → **EC2
`t3.micro`** (app) + **RDS PostgreSQL** already provisioned by
`aws/infrastructure.yaml`.

---

## 1. Design decision (why this pipeline)

Three viable free-tier patterns; **Pattern A is recommended** because it is
free, reliable, and reuses the existing `user-data.sh` + systemd setup.

| Option | Tools | Free tier | Fits your code? | Verdict |
|--------|-------|-----------|------------------|---------|
| **A. GitHub Actions → SSM Run Command to EC2** | GitHub free, AWS SSM (free) | 2,000 GA min/mo, SSM free on AL2023 | ✓ reuses `user-data.sh` | ✅ Recommended |
| B. AWS-only: CodePipeline → CodeBuild → CodeDeploy | CodePipeline + CodeBuild + CodeDeploy | 1 pipeline + 100 CodeBuild min/mo | ✓ slower, more parts | Good but more moving parts |
| C. GitHub Actions → S3 + cron poll on EC2 | S3 events | simplest, no SSH | ✓ fine for demo | Weak CD |

> **Why not CodeCommit?** Amazon stopped onboarding new CodeCommit customers
> (2024) — keep the repo on **GitHub**, which gives 2,000 free Actions
> minutes/month on private repos (beats CodeBuild's 100 free minutes).
>
> **Why not ALB/NAT/ECS?** `aws/infrastructure.yaml` already deliberately
> avoided NAT Gateway and ALB because they are not free. Keep one EC2 + one
> RDS; no containers/ECS needed for this tier.

---

## 2. Free-tier budget (what is actually free vs not)

| Service | Free tier | Cost after free tier |
|---|---|---|
| **EC2** `t3.micro` | 750 h/mo (needs a **new** AWS account, 12 mo) | ~$8–10/mo on-demand |
| **RDS** `db.t3.micro` 20 GB | 750 h/mo (**first 12 mo**) | ~$6–12/mo |
| **GitHub Actions** | 2,000 min/mo (private repo) | Pro pricing |
| **SSM Run Command / Parameters** | Free (AL2023 ships the SSM agent) | $0 |
| **S3** (artifacts) | 5 GB, 20k GET / 2k PUT | pennies |
| **CloudWatch** logs/metrics | 1 GB logs, 5 alarms, 10 metrics free | per GB after |
| **CodeDeploy / SSM for EC2** | Free for EC2 | $0 |
| **ACM certs, IAM, CloudFront basics** | Free | — |
| **NOT free** | NAT Gateway (~$35/mo), ALB (~$16/mo), detached EIPs | **avoid** |

> **Cost warning:** after the 12-month free tier, RDS is your most expensive
> component. A "forever cheap" production path is to run **PostgreSQL on the
> same EC2** instead of RDS (saves ~$6–12/mo). This is a design choice; the
> pipeline below works with either.

---

## 3. Recommended pipeline — end-to-end picture

```
[GitHub repo] ── push to branch/PR ──► [GitHub Actions]
                                        │
        ┌───────────────────────────────┴──────────────┐
        │  CI  (every push + PR)                      │
        │   1. setup-node 20 + npm ci                  │
        │   2. npm run build  (frontend → dist/)       │
        │   3. setup-python 3.11 + pip install          │
        │   4. run backend tests / lint                 │
        └───────────────────────────────┬──────────────┘
                                        │  on 'main' merge (or 'v*' tag) = CD
                                        ▼
        ┌───────────────────────────────┴──────────────┐
        │  CD / deploy job                             │
        │   1. configure AWS creds (OIDC — no keys)     │
        │   2. push artifact .tar.gz to S3              │
        │   3. SSM Run Command → EC2                    │
        │      → /opt/pde/deploy-cd.sh                  │
        │   4. health-check  GET /api/health            │
        └───────────────────────────────┬──────────────┘
                                        ▼
                       [EC2 t3.micro + existing .env]
                       systemd pde-api + Nginx
```
---

## 4. Prerequisites (one-time)

1. **Repo on GitHub** — public or private (private unlocks the 2,000 free
   Actions minutes/month). Current `aws/parameters/dev.json` already references
   a GitHub-style `RepoUrl`, so this matches.
2. **EC2 key pair** — already created for `KeyPairName` in `dev.json`.
3. **Deploy identity for CI** — do **not** create a long-lived user. Use
   **OIDC role assumption** (free, no rotating keys). Create IAM role
   `github-actions-role` trusting `token.actions.githubusercontent.com`, with
   the least-privilege policy in §6.
4. **(Optional, production)** A **domain + ACM certificate** in `us-east-1`
   with `AppDomain` / `AcmCertificateArn` set in `dev.json`, and
   `CorsOrigins` pointing at the real URL (so `CSRF_COOKIE_SECURE=True`).

---

## 5. The pipeline files to add to the repo

### 5.1 CI — `.github/workflows/ci.yml` (every push & PR)

Runs build + tests **only**. No AWS cost, catches bugs before merge. Never bakes
secrets into outputs.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend:
    name: Backend (lint + test)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      - name: Install backend deps
        working-directory: pde-backend
        run: pip install -r requirements.txt
      - name: Run backend tests  # add real tests under pde-backend/app/tests
        working-directory: pde-backend
        run: python -m pytest -q  # use a throwaway DB, NEVER RDS

  frontend:
    name: Frontend (build)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install + build
        working-directory: pde-frontend
        run: |
          npm ci
          npm run build
        env:
          # Same-origin /api via nginx — must match user-data.sh line 66
          VITE_API_BASE_URL: /
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: pde-frontend/dist
```

### 5.2 CD — `.github/workflows/deploy.yml` (on `main` merge or `v*` tag)

Deploy triggers **only** when code lands on `main` (or a release tag). Add a
`workflow_dispatch` so you can manually re-run or force a deploy.

```yaml
name: Deploy

on:
  push:
    branches: [main]            # or: tags: ['v*'] for deploy-on-tag only
  workflow_dispatch:            # manual re-run / force deploy

jobs:
  deploy:
    name: Deploy to production EC2
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: dist

      # 1) Authenticate to AWS via OIDC — no access keys in GitHub
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-region: ap-south-1
          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/github-actions

      # 2) Package + push the built artifact to your S3 ArtifactBucket
      - name: Upload build artifact to S3
        run: |
          tar -czf pde-dist-${{ github.sha }}.tar.gz dist
          aws s3 cp pde-dist-${{ github.sha }}.tar.gz \
            s3://<ARTIFACT_BUCKET>/deploy/
        env:
          AWS_DEFAULT_REGION: ap-south-1

      # 3) Trigger deploy on EC2 via SSM (agent already on AL2023)
      - name: Trigger deploy on EC2 via SSM
        run: |
          INSTANCE_ID=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=pde-app" \
            --query 'Reservations[0].Instances[0].InstanceId' --output text)
          aws ssm send-command \
            --instance-ids "$INSTANCE_ID" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=["/opt/pde/deploy-cd.sh"]' \
            --timeout-seconds 600 \
            --output text

      # 4) Post-deploy health check against your existing endpoint
      - name: Health check
        run: |
          curl --fail --retry 5 --retry-delay 20 \
            https://<APP_DOMAIN>/api/health || \
            curl --fail --retry 3 http://127.0.0.1:8000/api/health
```

### 5.3 On-box deploy script — `/opt/pde/deploy-cd.sh`

Because the EC2 already has git + systemd + nginx configured by `user-data.sh`,
the deploy on the box is small. It must **never** overwrite the existing
`.env` (which holds the real `SECRET_KEY` and `DB_PASSWORD`).

```bash
#!/usr/bin/env bash
# deploy-cd.sh — invoked by CI via SSM Run Command.
set -euo pipefail
APP_DIR=/opt/pde
REPO="$APP_DIR/pde"
SERVICE=pde-api

echo "==> pull latest code"
cd "$REPO"
git fetch --all
git checkout main && git pull --ff-only

echo "==> install backend deps"
"$APP_DIR/venv/bin/pip" install --upgrade -r "$REPO/pde-backend/requirements.txt"

echo "==> build frontend (same-origin /api, matches user-data)"
cd "$REPO/pde-frontend"
export VITE_API_BASE_URL=/
npm ci && npm run build

echo "==> restart API"
sudo systemctl restart "$SERVICE"

echo "==> health check"
curl -fsS http://127.0.0.1:8000/api/health && echo
echo "Deploy complete."
```

Place it at `/opt/pde/deploy-cd.sh`, make it executable
(`chmod +x /opt/pde/deploy-cd.sh`) and ensure `/opt/pde/venv` exists (it does —
created by `user-data.sh`). `systemctl` needs a runner with `sudo` rights (the
default `ec2-user` can `sudo` without a password on AL2023).
---

## 6. IAM — GitHub Actions OIDC role (replace access keys)

Create a role named `github-actions` with this **trust policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/<REPO>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

(Optionally loosen `sub` to `repo:<OWNER>/<REPO>:*` if you want PR builds to
also assume the role. Tightening it to `main` is more secure.)

And this **policy** (least privilege — only what the pipeline needs):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UploadArtifacts",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::<ARTIFACT_BUCKET>/deploy/*"
    },
    {
      "Sid": "FindInstance",
      "Effect": "Allow",
      "Action": ["ec2:DescribeInstances"],
      "Resource": "*"
    },
    {
      "Sid": "RunDeploy",
      "Effect": "Allow",
      "Action": ["ssm:SendCommand"],
      "Resource": "*"
    }
  ]
}
```

Once you know the instance ID, tighten `RunDeploy` to
`Resource: arn:aws:ec2:ap-south-1:<ACCOUNT_ID>:instance/<INSTANCE_ID>`.

---

## 7. Secrets — what must never be in the repo or CI

1. **Backend secrets** (`SECRET_KEY`, `DB_PASSWORD`) live **only** in the
   `pde-backend/.env` on the EC2. CI must never overwrite it and never ship it.
2. **No AWS access keys in job YAML.** Use the OIDC role above.
3. **No secrets in the client bundle.** `VITE_*` vars are baked into the build;
   only put non-secret config there (the build-time `VITE_API_BASE_URL=/`).
4. Keep `.env` in `.gitignore` (already the case) so CI never sees secrets.
5. Enable **Dependabot** vulnerability alerts in the repo (free) to flag
   outdated/known-vulnerable deps.

---

## 8. Development → Staging → Production promotion (free-tier reality)

The free tier cannot run a second full EC2 + RDS forever. Realistic mapping:

| Stage | Trigger | What runs |
|---|---|---|
| **Dev / PR** | Push to a feature branch / PR | CI only (`ci.yml`) — build + tests, **no deploy** |
| **Staging** | Merge to `main` | CD job to the **same EC2** with a second systemd unit (e.g. `pde-api-staging` on `:8100` + its own `.env`) — **no new EC2/RDS** |
| **Production** | `git tag v1.2.3` (after UAT) | CD job to the real EC2 on `main` port :8000, `CSRF_COOKIE_SECURE=True`, real domain |

If shared-DB staging is too risky, the other free-tier-friendly option is a
**Lambda + API Gateway + images** staging environment (free tier: 1M requests/
mo). Only add that if you need DB isolation — it adds ops overhead.

For most teams: **PR → CI gate → merge to main → auto-deploy to staging (same
box) → click "Promote" (tag) → deploy to prod.** A real, defensible free-tier CD.

---

## 9. Hardening for production (finish what the repo already starts)

- [ ] Keep `DEBUG=False` and set `CSRF_COOKIE_SECURE=True` (the
      `user-data.sh` bootstrap already sets these based on `AppDomain`).
- [ ] Use the **custom-domain + CloudFront** path (already scripted) so cookies
      with the `Secure` flag work over HTTPS.
- [ ] Never rebuild `.env` on the EC2 from CI — CI only `git pull`s and runs
      `systemctl restart`.
- [ ] Scope the SSM/OIDC role to the **one instance** (see §6).
- [ ] Add a manual/`environment` gate for the production job so an accidental
      push to `main` can't hit prod.
- [ ] Keep CI **read-only against the DB**: backend tests use a throwaway local
      database, never RDS.
- [ ] Turn on GitHub **vulnerability_alerts** + **branch protection** on `main`
      (require CI to pass before merge).

---

## 10. Pitfalls in this specific repo (avoid reintroducing bugs)

1. **`VITE_API_BASE_URL` must be `/` at build time** (same-origin via nginx),
   exactly like `user-data.sh`. Any other value breaks the SPA→API path.
2. **Never overwrite `pde-backend/.env`** from CI — you'd clobber the DB
   password and CSRF vars the box already has.
3. **Keep `.env` out of the repo**; `.env.example` is the only tracked copy.
4. **The S3 bucket uses `DeletionPolicy: Retain`** — deploy artifacts will
   accumulate; add a lifecycle rule (e.g. delete `deploy/*` > 14 days) or it
   outgrows the 5 GB free tier.
5. **`docker-compose.yml` is local-dev only** (it embeds a placeholder
   `SECRET_KEY`) — do not let CI ship it or its values to prod.

---

## 11. Realistic ongoing cost (first 12 months)

- GitHub Actions: `$0` (2,000 min/mo is ample for `npm ci` + build + pytest).
- SSM / EC2 / S3 / CloudWatch small footprint: `$0`.
- After month 12 (un-reserved), `t3.micro` + `db.t3.micro` ≈ **$18–22/mo**.
  Cheapest long-term path: run PostgreSQL on the EC2 instead of RDS (drop the
  RDS half), keeping most of the stack at `$0`.

---

## 12. Getting started (checklist)

1. Push this repo to GitHub (main branch).
2. Create the OIDC role + policy from §6; note the `role-to-assume` ARN, the
   `<ACCOUNT_ID>`, and your `<ARTIFACT_BUCKET>` name (from the CFN output).
3. Add the three files from §5 into the repo.
4. On the EC2: write `/opt/pde/deploy-cd.sh` (from §5.3) and `chmod +x`.
5. Run `deploy.yml` manually via `workflow_dispatch`, verify CI passes and the
   SSM deploy completes, then check `https://<APP_DOMAIN>/api/health`.
6. Merge a test PR → confirm `ci.yml` gates it → then `git tag` to promote to
   production.