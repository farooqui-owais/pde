# =============================================================================
# terraform.tfvars - PDE PRE-PRODUCTION values
# Replace every REPLACE_ME before `terraform apply`.
# =============================================================================

aws_region = "ap-south-1"
# environment_name defaults to "pde-preprod"; keep the separate pre-prod
# VPC CIDR (10.10.0.0/16) so pre-prod and prod never share address space.

# SSH: your office/home IP (find it with: curl -s ifconfig.me)
ssh_ingress_cidr = "0.0.0.0/0" # preprod: OK open; tighten for prod

# The key pair must already exist in this region (aws ec2 create-key-pair).
key_pair_name = "pde-key"

# Repo to deploy. The repo is PRIVATE -> pass a token-bearing URL at deploy
# time only (terraform apply -var repo_url=...), never commit it.
# repo_url    = "https://GITHUB_TOKEN@github.com/farooqui-owais/pde.git"
repo_branch = "main"

# Pre-prod app settings (HTTP only, permissive trusted hosts).
cors_origins  = "http://localhost:5173,http://127.0.0.1:5173"
trusted_hosts = "*"
app_domain    = ""

# Optional CDN/HTTPS: set app_domain + acm_certificate_arn (in us-east-1)
# and enable_cloudfront = true.
enable_cloudfront  = false
create_hosted_zone = false # Route 53 is PAID - only if you really host DNS here

# Alerts: your email (you must confirm the SNS subscription once).
alert_email = ""

# Free-tier sizing (do not raise these on a free-tier account).
instance_type        = "t3.micro"
db_instance_class    = "db.t3.micro"
db_allocated_storage = 20
