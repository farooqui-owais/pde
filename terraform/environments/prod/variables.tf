# =============================================================================
# variables.tf - PDE PRODUCTION environment inputs (same shape as preprod,
# with production-hardened defaults: deletion protection, longer backups).
# =============================================================================
variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project / billing tag."
  type        = string
  default     = "dakhalnama"
}

variable "environment_name" {
  description = "Short environment name used in tags, names and the SSM path."
  type        = string
  default     = "pde-prod"
}

# --- Networking ---------------------------------------------------------------
variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "public_subnet_cidr" {
  type    = string
  default = "10.20.1.0/24"
}

variable "db_subnet_cidr" {
  type    = string
  default = "10.20.2.0/24"
}

variable "db_subnet_cidr_2" {
  type    = string
  default = "10.20.3.0/24"
}

variable "ssh_ingress_cidr" {
  description = "Restrict SSH to your IP for production (x.x.x.x/32). REQUIRED to change."
  type        = string
  default     = "0.0.0.0/0"
}

# --- Compute -------------------------------------------------------------------
variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_pair_name" {
  description = "Existing EC2 key pair name in this region."
  type        = string
}

variable "repo_url" {
  description = "Git repo with pde-backend/ and pde-frontend/. For a PRIVATE repo pass https://TOKEN@github.com/you/pde.git (deploy-time only, never commit)."
  type        = string
  default     = "https://github.com/farooqui-owais/pde.git"
}

variable "repo_branch" {
  description = "Production deploys a dedicated release tag/branch, not main."
  type        = string
  default     = "main"
}

variable "app_dir" {
  type    = string
  default = "/opt/pde"
}

# --- Database -------------------------------------------------------------------
variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "pde"
}

variable "db_user" {
  type    = string
  default = "dakhal_user"
}

variable "backup_retention_period" {
  description = "Automated backup retention in days (prod: keep 7)."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "RDS deletion protection (prod: true)."
  type        = bool
  default     = true
}

# --- Application ----------------------------------------------------------------
variable "app_domain" {
  description = "Production custom domain (app.example.com)."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for the CloudFront distribution."
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "CORS origins - in prod include your https domain."
  type        = string
  default     = "http://localhost:5173,http://127.0.0.1:5173"
}

variable "trusted_hosts" {
  description = "Trusted hosts - set to your domain in prod."
  type        = string
  default     = "*"
}

# --- CDN / DNS -------------------------------------------------------------------
variable "enable_cloudfront" {
  description = "Create CloudFront + Route53 (needs app_domain + ACM cert in us-east-1)."
  type        = bool
  default     = false
}

variable "create_hosted_zone" {
  description = "Create a Route 53 hosted zone (Route 53 is PAID - set false if DNS is hosted elsewhere)."
  type        = bool
  default     = false
}

# --- Monitoring -------------------------------------------------------------------
variable "alert_email" {
  description = "Where alarms are emailed (recommended in prod)."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "ec2_cpu_alarm_threshold" {
  type    = number
  default = 85
}

variable "db_free_storage_alarm_threshold" {
  type    = number
  default = 2147483648 # 2 GB in bytes
}
