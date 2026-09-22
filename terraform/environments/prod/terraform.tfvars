# =============================================================================
# terraform.tfvars - PDE PRODUCTION values
# Replace every REPLACE_ME before `terraform apply`. Never commit real secrets.
# =============================================================================

aws_region       = "ap-south-1"
environment_name = "pde-prod"

# SSH: REQUIRED - restrict to your IP for production (find it: curl -s ifconfig.me)
ssh_ingress_cidr = "0.0.0.0/0" # CHANGE ME to e.g. "1.2.3.4/32"

# The key pair must already exist in this region (aws ec2 create-key-pair).
key_pair_name = "pde-key"

# Repo to deploy. The repo is PRIVATE -> pass a token-bearing URL at deploy
# time only (terraform apply -var repo_url=...), never commit it.
# repo_url    = "https://GITHUB_TOKEN@github.com/farooqui-owais/pde.git"
repo_branch = "main" # use a release tag/branch for production

# Production app settings - HTTPS via CloudFront recommended so
# CSRF_COOKIE_SECURE=True applies (set automatically when app_domain is set).
app_domain    = ""                                            # e.g. "app.example.com"
cors_origins  = "http://localhost:5173,http://127.0.0.1:5173" # add https domain
trusted_hosts = "*"                                           # set to app.example.com

# CDN/HTTPS: set app_domain + acm_certificate_arn (us-east-1), then enable.
enable_cloudfront  = false
create_hosted_zone = false # Route 53 is PAID - only if you host DNS here

# Alerts: your on-call email (confirm the SNS subscription once).
alert_email = ""

# Free-tier sizing (do not raise these on a free-tier account).
instance_type           = "t3.micro"
db_instance_class       = "db.t3.micro"
db_allocated_storage    = 20
deletion_protection     = true
backup_retention_period = 7
