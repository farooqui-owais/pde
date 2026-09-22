output "db_endpoint" {
  description = "Postgres endpoint (host:port)."
  value       = aws_db_instance.this.endpoint
}

output "db_host" {
  description = "Postgres hostname."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Postgres port."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Initial database name."
  value       = var.db_name
}

output "db_user" {
  description = "Postgres master username."
  value       = var.db_user
}

output "db_instance_id" {
  description = "RDS instance identifier (used by CloudWatch alarms)."
  value       = aws_db_instance.this.identifier
}

output "db_password_ssm_arn" {
  description = "ARN of the SSM SecureString holding the master password."
  value       = aws_ssm_parameter.db_master_password.arn
}

output "db_password_ssm_name" {
  description = "Name of the SSM SecureString holding the master password."
  value       = aws_ssm_parameter.db_master_password.name
}
