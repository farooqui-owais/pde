# =============================================================================
# variables.tf - PDE pre-production environment inputs
# =============================================================================
variable "aws_region" {
  description = "AWS region (free-tier eligible regions: us-east-1, us-west-2, etc.)."
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
  default     = "pde-preprod"
}

# --- Networking ---------------------------------------------------------------
variable "vpc_cidr" {
  type    = string
  default = "10.10.0.0/16"
}

variable "public_subnet_cidr" {
  type    = string
  default = "10.10.1.0/24"
}

variable "db_subnet_cidr" {
  type    = string
  default = "10.10.2.0/24"
}

variable "db_subnet_cidr_2" {
  type    = string
  default = "10.10.3.0/24"
}

variable "ssh_ingress_cidr" {
  description = "Restrict SSH to your IP for production (x.x.x.x/32)."
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
  type    = string
  default = "main"
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
  type    = number
  default = 1
}

# --- Application ----------------------------------------------------------------
variable "app_domain" {
  type    = string
  default = ""
}

variable "acm_certificate_arn" {
  type    = string
  default = ""
}

variable "cors_origins" {
  type    = string
  default = "http://localhost:5173,http://127.0.0.1:5173"
}

variable "trusted_hosts" {
  type    = string
  default = "*"
}

# --- CDN / DNS -------------------------------------------------------------------
variable "enable_cloudfront" {
  description = "Create CloudFront + Route53 (needs app_domain + ACM cert in us-east-1)."
  type        = bool
  default     = false
}

variable "create_hosted_zone" {
  description = "Create a Route 53 hosted zone (Route 53 is PAID - set false if DNS lives elsewhere)."
  type        = bool
  default     = false
}

# --- Monitoring -------------------------------------------------------------------
variable "alert_email" {
  type    = string
  default = ""
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "ec2_cpu_alarm_threshold" {
  type    = number
  default = 85
}

variable "db_free_storage_alarm_threshold" {
  type    = number
  default = 2147483648 # 2 GB in bytes
}
