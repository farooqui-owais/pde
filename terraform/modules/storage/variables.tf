# =============================================================================
# variables.tf - inputs for the PDE storage module (encrypted, versioned S3)
# =============================================================================
variable "project_name" {
  description = "Project / billing tag."
  type        = string
}

variable "environment_name" {
  description = "Short environment name used in tags and bucket name."
  type        = string
}

variable "noncurrent_version_expiration_days" {
  description = "Expire noncurrent object versions after this many days (keeps the bucket inside the 5 GB free tier)."
  type        = number
  default     = 90
}

variable "enable_cloudfront_logging" {
  description = "Prepare the bucket for CloudFront access logs (prefix cloudfront-logs/)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
