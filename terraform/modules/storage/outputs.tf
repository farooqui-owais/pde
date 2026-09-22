output "bucket_name" {
  description = "Name of the artifacts bucket."
  value       = aws_s3_bucket.artifacts.id
}

output "bucket_arn" {
  description = "ARN of the artifacts bucket."
  value       = aws_s3_bucket.artifacts.arn
}

output "bucket_domain_name" {
  description = "Regional domain name of the artifacts bucket (for CloudFront logging)."
  value       = aws_s3_bucket.artifacts.bucket_regional_domain_name
}
