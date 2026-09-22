output "instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Public IP of the instance."
  value       = aws_instance.app.public_ip
}

output "elastic_ip" {
  description = "Stable public IP (empty when enable_eip = false)."
  value       = var.enable_eip ? aws_eip.app[0].public_ip : null
}

output "public_dns" {
  description = "Public DNS of the instance (CloudFront origin)."
  value       = aws_instance.app.public_dns
}

output "iam_role_name" {
  description = "IAM role attached to the instance."
  value       = aws_iam_role.ec2.name
}

output "instance_profile_arn" {
  description = "ARN of the instance profile."
  value       = aws_iam_instance_profile.ec2.arn
}

output "jwt_secret_ssm_name" {
  description = "SSM SecureString name holding the JWT secret."
  value       = aws_ssm_parameter.jwt_secret.name
}
