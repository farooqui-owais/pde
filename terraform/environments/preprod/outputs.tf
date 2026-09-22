# =============================================================================
# outputs.tf - everything you need to reach and operate the environment
# =============================================================================
output "public_ip" {
  description = "Stable public IP of the app server (HTTP unless domain/CDN used)."
  value       = module.compute.elastic_ip
}

output "public_dns" {
  description = "Public DNS of the app server."
  value       = module.compute.public_dns
}

output "app_http_url" {
  description = "Direct HTTP URL (dev/preprod). Use the CloudFront domain for production."
  value       = "http://${module.compute.elastic_ip}"
}

output "api_health_check" {
  description = "Health endpoint."
  value       = "http://${module.compute.elastic_ip}/api/health"
}

output "database_endpoint" {
  description = "Postgres endpoint."
  value       = module.database.db_endpoint
}

output "database_name" {
  value = module.database.db_name
}

output "artifact_bucket" {
  description = "Encrypted, versioned S3 bucket."
  value       = module.storage.bucket_name
}

output "cloudfront_domain" {
  description = "CloudFront/CDN URL (set null when disabled)."
  value       = var.enable_cloudfront ? module.cdn[0].cloudfront_domain : null
}

output "db_password_ssm_name" {
  description = "SSM SecureString holding the DB password (get with --with-decryption)."
  value       = module.database.db_password_ssm_name
}

output "jwt_secret_ssm_name" {
  description = "SSM SecureString holding the JWT secret."
  value       = module.compute.jwt_secret_ssm_name
}

output "app_log_group" {
  value = module.monitoring.app_log_group_name
}

output "alert_topic_arn" {
  value = module.monitoring.alert_topic_arn
}

output "name_servers" {
  description = "Route 53 nameservers to set at your registrar (null when zone not created)."
  value       = var.enable_cloudfront && var.create_hosted_zone ? module.cdn[0].name_servers : null
}
