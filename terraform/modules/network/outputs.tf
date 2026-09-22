output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "public_subnet_id" {
  description = "ID of the public (app) subnet."
  value       = aws_subnet.public.id
}

output "db_subnet_ids" {
  description = "IDs of the private (DB) subnets, one per AZ."
  value       = aws_subnet.db[*].id
}

output "web_security_group_id" {
  description = "ID of the web/app security group."
  value       = aws_security_group.web.id
}

output "db_security_group_id" {
  description = "ID of the database security group."
  value       = aws_security_group.db.id
}
