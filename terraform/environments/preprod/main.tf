# =============================================================================
# main.tf - PDE pre-production: wires all modules together (free tier)
# =============================================================================
module "network" {
  source = "../../modules/network"

  project_name       = var.project_name
  environment_name   = var.environment_name
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  db_subnet_cidr     = var.db_subnet_cidr
  db_subnet_cidr_2   = var.db_subnet_cidr_2
  ssh_ingress_cidr   = var.ssh_ingress_cidr
}

module "storage" {
  source = "../../modules/storage"

  project_name     = var.project_name
  environment_name = var.environment_name
}

module "database" {
  source = "../../modules/database"

  project_name            = var.project_name
  environment_name        = var.environment_name
  db_subnet_ids           = module.network.db_subnet_ids
  db_security_group_id    = module.network.db_security_group_id
  db_instance_class       = var.db_instance_class
  db_allocated_storage    = var.db_allocated_storage
  db_name                 = var.db_name
  db_user                 = var.db_user
  backup_retention_period = var.backup_retention_period
}

module "compute" {
  source = "../../modules/compute"

  project_name         = var.project_name
  environment_name     = var.environment_name
  instance_type        = var.instance_type
  key_pair_name        = var.key_pair_name
  subnet_id            = module.network.public_subnet_id
  security_group_id    = module.network.web_security_group_id
  repo_url             = var.repo_url
  repo_branch          = var.repo_branch
  app_dir              = var.app_dir
  app_domain           = var.app_domain
  cors_origins         = var.cors_origins
  trusted_hosts        = var.trusted_hosts
  db_host              = module.database.db_host
  db_port              = module.database.db_port
  db_name              = module.database.db_name
  db_user              = module.database.db_user
  db_password_ssm_name = module.database.db_password_ssm_name
  enable_eip           = true
}

# CloudFront is only created when a domain + us-east-1 ACM cert are provided.
module "cdn" {
  count  = var.enable_cloudfront ? 1 : 0
  source = "../../modules/cdn"

  project_name                = var.project_name
  environment_name            = var.environment_name
  origin_domain               = module.compute.public_dns
  app_domain                  = var.app_domain
  acm_certificate_arn         = var.acm_certificate_arn
  artifact_bucket_domain_name = module.storage.bucket_domain_name
  create_hosted_zone          = var.create_hosted_zone
}

module "monitoring" {
  source = "../../modules/monitoring"

  environment_name                = var.environment_name
  app_instance_id                 = module.compute.instance_id
  db_instance_id                  = module.database.db_instance_id
  alert_email                     = var.alert_email
  log_retention_days              = var.log_retention_days
  ec2_cpu_alarm_threshold         = var.ec2_cpu_alarm_threshold
  db_free_storage_alarm_threshold = var.db_free_storage_alarm_threshold
}
