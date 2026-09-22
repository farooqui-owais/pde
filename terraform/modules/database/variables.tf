# =============================================================================
# variables.tf - inputs for the PDE database module (free-tier RDS)
# =============================================================================
variable "project_name" {
  description = "Project / billing tag."
  type        = string
}

variable "environment_name" {
  description = "Short environment name used in tags and resource names."
  type        = string
}

variable "db_subnet_ids" {
  description = "Private subnet IDs for the RDS subnet group (>= 2 AZs)."
  type        = list(string)
}

variable "db_security_group_id" {
  description = "Security group ID that allows Postgres access to the DB."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class. db.t3.micro = free-tier eligible (single-AZ)."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Postgres storage in GB (20 GB = free-tier limit)."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Upper limit for storage autoscaling. Keep == allocated_storage to stay in the free tier."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "pde"
}

variable "db_user" {
  description = "Postgres master username."
  type        = string
  default     = "dakhal_user"
}

variable "deletion_protection" {
  description = "Enable RDS deletion protection (recommended: true for prod)."
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Automated backup retention in days (1 day = free-tier friendly)."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
