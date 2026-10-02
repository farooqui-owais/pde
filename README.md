# PDE â€” Production Branch (`prod`)

Minimal branch used for the **AWS production deployment**. It contains only
what the Terraform-launched EC2 instance needs at boot (see
`terraform/modules/compute/templates/user_data.sh.tpl`): the backend, the
frontend and the infrastructure code. Developer/local-only files are kept on
`main` to avoid confusion.

## Layout

```
prod/
â”œâ”€â”€ terraform/
â”‚   â”œâ”€â”€ environments/prod/   prod stack: VPC 10.20.0.0/16, RDS deletion
â”‚   â”‚                         protection, 1-day free-tier backups, 30-day logs
â”‚   â”œâ”€â”€ modules/              network, compute, database, storage, cdn, monitoring
â”‚   â””â”€â”€ bootstrap/            one-time S3/DynamoDB remote-state setup
â”œâ”€â”€ pde-backend/              FastAPI + SQLAlchemy (requirements.txt + app/)
â”œâ”€â”€ pde-frontend/             React + Vite (src/, built with `npm ci && npm run build`)
â”œâ”€â”€ .gitignore                prod-focused ignores
â””â”€â”€ .gitattributes            keeps shell scripts LF for Linux
```

## Deploy

```powershell
cd terraform\environments\prod
terraform init
terraform apply -var "repo_branch=prod" -var "repo_url=https://TOKEN@github.com/farooqui-owais/pde.git"
```

Full instructions, secrets model (SSM SecureString) and the hardening
checklist are in [`terraform/README.md`](terraform/README.md).

