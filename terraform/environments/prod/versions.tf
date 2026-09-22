# =============================================================================
# versions.tf - providers + Terraform version pins (PDE PRODUCTION)
# =============================================================================
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Default: local state. For shared/CI state, uncomment backend.tf and run
  # `terraform init` (see terraform/README.md "Remote state").
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment_name
      ManagedBy   = "terraform"
    }
  }
}
