# =============================================================================
# variables.tf - inputs for the PDE compute module (EC2 app server)
# =============================================================================
variable "project_name" {
  description = "Project / billing tag."
  type        = string
}

variable "environment_name" {
  description = "Short environment name used in tags and resource names."
  type        = string
}

variable "instance_type" {
  description = "EC2 type. t3.micro = free-tier eligible (750 h/mo)."
  type        = string
  default     = "t3.micro"
}

variable "key_pair_name" {
  description = "Existing EC2 key-pair name for SSH access."
  type        = string
}

variable "subnet_id" {
  description = "Public subnet ID to launch the app instance in."
  type        = string
}

variable "security_group_id" {
  description = "Web/app security group ID."
  type        = string
}

variable "root_volume_size" {
  description = "Root EBS size in GB (gp3, encrypted)."
  type        = number
  default     = 20
}

variable "repo_url" {
  description = "Git repo containing pde-backend/ and pde-frontend/. For a PRIVATE repo pass https://TOKEN@github.com/you/pde.git."
  type        = string
  default     = "https://github.com/farooqui-owais/pde.git"
}

variable "repo_branch" {
  description = "Branch/tag to deploy."
  type        = string
  default     = "main"
}

variable "app_dir" {
  description = "Install directory on the instance."
  type        = string
  default     = "/opt/pde"
}

variable "app_domain" {
  description = "Optional custom domain (app.example.com). Enables CSRF_COOKIE_SECURE."
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "Comma-separated allowed CORS origins (include the app domain in prod)."
  type        = string
  default     = "http://localhost:5173,http://127.0.0.1:5173"
}

variable "trusted_hosts" {
  description = "API TRUSTED_HOSTS (set to the app domain in production)."
  type        = string
  default     = "*"
}

variable "db_host" {
  description = "RDS endpoint hostname for DATABASE_URL."
  type        = string
}

variable "db_port" {
  description = "RDS port."
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Postgres database name."
  type        = string
  default     = "pde"
}

variable "db_user" {
  description = "Postgres master username."
  type        = string
}

variable "db_password_ssm_name" {
  description = "SSM SecureString name holding the RDS master password (fetched by user-data)."
  type        = string
}

variable "enable_eip" {
  description = "Create + attach an Elastic IP (free while attached to a running instance)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
