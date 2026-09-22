# =============================================================================
# main.tf - RDS PostgreSQL (single-AZ db.t3.micro, private subnets) plus the
# free SSM SecureString that holds the generated master password. The app
# instance reads it at bootstrap time, so no secret is ever hardcoded.
# =============================================================================

# Letters + digits only so the password is safe inside a shell-generated .env.
resource "random_password" "db_master" {
  length           = 24
  special          = false
  override_special = ""
}

resource "aws_ssm_parameter" "db_master_password" {
  name        = "/pde/${var.environment_name}/db-master-password"
  description = "RDS master password for the PDE ${var.environment_name} database (do not print)."
  type        = "SecureString"
  value       = random_password.db_master.result

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-db-secret"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.environment_name}-db-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-db-subnet-group"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_db_instance" "this" {
  identifier             = "${var.environment_name}-postgres"
  engine                 = "postgres"
  engine_version         = "16.8"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = var.db_max_allocated_storage
  storage_type           = "gp2"
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_user
  password               = random_password.db_master.result
  port                   = 5432
  multi_az               = false
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.db_security_group_id]

  backup_retention_period    = var.backup_retention_period
  backup_window              = "02:00-03:00"
  maintenance_window         = "sun:04:00-sun:05:00"
  auto_minor_version_upgrade = true
  deletion_protection        = var.deletion_protection
  copy_tags_to_snapshot      = true
  delete_automated_backups   = true
  skip_final_snapshot        = !var.deletion_protection
  final_snapshot_identifier  = var.deletion_protection ? "${var.environment_name}-postgres-final" : null
  apply_immediately          = true

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-postgres"
    Environment = var.environment_name
    Project     = var.project_name
  })
}
