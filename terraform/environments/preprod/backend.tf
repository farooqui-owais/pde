# =============================================================================
# backend.tf - remote state (S3 + DynamoDB locking).
# Uncomment and edit after running terraform/bootstrap/README.md once, then:
#   terraform init -reconfigure
#
# terraform {
#   backend "s3" {
#     bucket         = "pde-tfstate-<ACCOUNT_ID>"
#     key            = "pde-preprod.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "pde-tfstate-lock"
#     encrypt        = true
#   }
# }
# =============================================================================
