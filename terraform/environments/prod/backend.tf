# =============================================================================
# backend.tf - remote state (S3 + DynamoDB locking).
# Uncomment and edit after running terraform/bootstrap/README.md once, then:
#   terraform init -reconfigure
#
# State contains generated secrets' REFERENCES only (they live in SSM), but a
# shared bucket is still strongly recommended for team/CI workflows.
#
# terraform {
#   backend "s3" {
#     bucket         = "pde-tfstate-<ACCOUNT_ID>"
#     key            = "pde-prod.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "pde-tfstate-lock"
#     encrypt        = true
#   }
# }
# =============================================================================
