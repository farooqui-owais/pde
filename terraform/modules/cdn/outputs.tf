output "cloudfront_domain" {
  description = "CloudFront distribution domain (use in CORS_ORIGINS)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution."
  value       = aws_cloudfront_distribution.this.id
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID (null when not created)."
  value       = var.create_hosted_zone ? aws_route53_zone.this[0].zone_id : null
}

output "name_servers" {
  description = "Nameservers to set at your registrar (null when zone not created)."
  value       = var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : null
}
