# =============================================================================
# variables.tf - inputs for the PDE network module (free-tier VPC)
# =============================================================================
variable "project_name" {
  description = "Project / billing tag (e.g. dakhalnama)."
  type        = string
}

variable "environment_name" {
  description = "Short environment name used in tags and resource names (e.g. pde-preprod)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR for the public (app) subnet."
  type        = string
  default     = "10.0.1.0/24"
}

variable "db_subnet_cidr" {
  description = "CIDR for the first private (DB) subnet."
  type        = string
  default     = "10.0.2.0/24"
}

variable "db_subnet_cidr_2" {
  description = "CIDR for the second private (DB) subnet (RDS needs >= 2 AZs)."
  type        = string
  default     = "10.0.3.0/24"
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH to the app server. Restrict to your IP (x.x.x.x/32) for production."
  type        = string
  default     = "0.0.0.0/0"
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
