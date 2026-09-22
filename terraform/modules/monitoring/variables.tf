# =============================================================================
# variables.tf - inputs for the PDE monitoring module (CloudWatch + SNS)
# =============================================================================
variable "environment_name" {
  description = "Short environment name used in names."
  type        = string
}

variable "app_instance_id" {
  description = "EC2 instance ID to alarm on."
  type        = string
}

variable "db_instance_id" {
  description = "RDS instance identifier to alarm on."
  type        = string
}

variable "alert_email" {
  description = "Email for CloudWatch/SNS alarm notifications. Empty disables SNS/alarms (free tier: 1M email notifications/mo is generous; alarms themselves are free)."
  type        = string
  default     = ""
}

variable "ec2_cpu_alarm_threshold" {
  description = "CPU % threshold for the app instance alarm."
  type        = number
  default     = 85
}

variable "db_free_storage_alarm_threshold" {
  description = "Free storage (bytes) threshold for the DB alarm."
  type        = number
  default     = 2147483648 # 2 GB
}

variable "log_retention_days" {
  description = "CloudWatch log retention (free tier includes 1 GB ingestion/mo)."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
