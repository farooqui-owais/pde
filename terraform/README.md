# PDE — Terraform (AWS free tier, pre-prod + prod)

Infrastructure-as-Code replacement for the legacy `aws/infrastructure.yaml`
CloudFormation stack. Same proven free-tier architecture, now in modular,
environment-scoped Terraform:

```
terraform/
├── modules/
│   ├── network/      VPC, public+private subnets, IGW, route tables, SGs
│   ├── compute/      IAM role/profile, EC2 t3.micro (Nginx+Gunicorn/FastAPI),
│   │                 EIP, JWT secret in SSM, bootstrap user-data
│   ├── database/     RDS PostgreSQL 16 db.t3.micro (private, encrypted) +
│   │                 master password in SSM SecureString
│   ├── storage/      Encrypted, versioned S3 bucket (TLS-only policy)
│   ├── cdn/          Optional CloudFront + Route 53 (needs domain+ACM cert)
│   └── monitoring/   CloudWatch log group + alarms, SNS email
├── environments/
│   ├── preprod/      pde-preprod, VPC 10.10.0.0/16, permissive defaults
│   ├── prod/         pde-prod,   VPC 10.20.0.0/16, hardened defaults
│   │                 (RDS deletion protection, 7-day backups, 30-day logs)
│   └── (each has its own state, variables and tfvars)
├── bootstrap/        One-time S3/DynamoDB state backend setup (README)
└── .gitignore        Keeps *.tfstate and *.auto.tfvars out of git
```

## Free-tier mapping (unchanged from the CloudFormation design)

| Component | Choice | Why |
|---|---|---|
| Compute | EC2 `t3.micro`, 20 GB gp3 | 750 h/mo free; no ALB (paid) |
| Database | RDS `db.t3.micro`, 20 GB gp2, single-AZ, private subnets | Free tier; no NAT GW (paid) |
| Storage | S3, versioned + encrypted + lifecycle expiry | 5 GB free |
| CDN/TLS | CloudFront `PriceClass_100` (optional) | 1 TB egress + 10 M req free |
| Secrets | SSM Parameter Store SecureStrings | Free; nothing in state plaintext or user-data |
| Monitoring | CloudWatch alarms + SNS email | Free tier |

## 1. Prerequisites

1. Terraform ≥ 1.6 (tested with 1.12) and AWS CLI configured (`aws configure`).
2. An EC2 key pair in your target region: `aws ec2 create-key-pair --key-name pde-key ...`
3. The repo is **private** — the instance clones it at boot. Pass a token URL
   at deploy time only (never commit it):
   `-var "repo_url=https://GITHUB_TOKEN@github.com/farooqui-owais/pde.git"`

## 2. Deploy pre-prod

```powershell
cd terraform\environments\preprod
terraform init
terraform plan   # review
terraform apply
```

Wait ~10–15 min for user-data to install/build the app, then open
`http://<public_ip>/api/health` (the IP is printed in the outputs).

## 3. Deploy production

1. Edit `terraform\environments\prod\terraform.tfvars`:
   - `ssh_ingress_cidr` → your IP (`x.x.x.x/32`) — **required**
   - `app_domain`, `cors_origins`, `trusted_hosts` → your real domain
   - `alert_email` → your on-call email (confirm the SNS subscription email)
2. For HTTPS/CDN: request an ACM cert for the domain **in `us-east-1`**,
   set `acm_certificate_arn` + `enable_cloudfront = true`.
   Set `create_hosted_zone = true` only if Route 53 should host DNS (paid).
3. Deploy a release tag/branch, not `main`:

```powershell
cd terraform\environments\prod
terraform init
terraform apply -var "repo_branch=main" -var "repo_url=https://TOKEN@github.com/farooqui-owais/pde.git"
```

## 4. Secrets model

- RDS master password and the JWT `SECRET_KEY` are generated with
  `random_password` and stored as **SSM SecureStrings**
  (`/pde/<env>/db-master-password`, `/pde/<env>/jwt-secret`).
- The instance fetches them at boot via its IAM role; `.env` is `chmod 600`.
- To rotate: `terraform taint`/`-replace` the corresponding
  `aws_ssm_parameter` (DB rotation also requires an RDS master-password
  change) or update the value in SSM and restart the app.

## 5. Day-2 operations

- **Redeploy app code**: push to the branch, then on the instance run
  `sudo /opt/pde/deploy-cd.sh` (or wire it to GitHub Actions via SSM Run
  Command as described in `CICD.md`).
- **Terraform updates**: edit tfvars/variables → `terraform apply`.
- **Destroy**: `terraform destroy` (preprod wipes cleanly; prod RDS has
  deletion protection and takes a final snapshot — the S3 bucket is retained).
- **Remote state**: see `bootstrap/README.md` and the commented
  `backend.tf` in each environment.

## 6. Production hardening checklist

- [ ] `ssh_ingress_cidr` restricted to your IP
- [ ] Real `app_domain` + ACM cert + CloudFront (enables `CSRF_COOKIE_SECURE`)
- [ ] `trusted_hosts` set to the domain (no `*`), CORS origins narrowed
- [ ] `alert_email` set and SNS subscription confirmed
- [ ] Private repo: deploy with a short-lived fine-grained token; never commit
- [ ] Replace the illustrative stamp-duty rates in
      `pde-backend/app/routers/documents.py` with the official schedule
- [ ] Test the S3 backup path + RDS snapshot restore before go-live
- [ ] Optional: AWS WAF on CloudFront for public workloads

> After the 12-month free tier, expect roughly **$14–20/mo** (single EC2 +
> single-AZ RDS, ap-south-1 on-demand). Route 53 hosted zones (~$0.50/mo each)
> and detached EIPs are the classic surprises — both flagged above.
