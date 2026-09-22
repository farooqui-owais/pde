# =============================================================================
# variables.tf - inputs for the PDE CDN module (optional CloudFront + Route 53)
# =============================================================================
variable "project_name" {
  description = "Project / billing tag."
  type        = string
}

variable "environment_name" {
  description = "Short environment name used in tags and names."
  type        = string
}

variable "origin_domain" {
  description = "Origin domain to front (the app instance public DNS)."
  type        = string
}

variable "app_domain" {
  description = "Custom domain for the distribution (app.example.com)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of an ACM certificate in us-east-1 matching app_domain."
  type        = string
}

variable "artifact_bucket_domain_name" {
  description = "Artifacts bucket regional domain name used for distribution logs."
  type        = string
}

variable "create_hosted_zone" {
  description = "Create a Route 53 hosted zone + alias records for the domain (Route 53 is a paid service - set false if DNS is hosted elsewhere)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
