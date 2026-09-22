# Terraform state backend bootstrap (one-time, ~2 min)

Creates the S3 bucket + DynamoDB lock table used by the (optional) remote
backends in `environments/*/backend.tf`. Both resources are inside the AWS
free tier (S3 first 5 GB, DynamoDB 25 GB / 25 RCU-WCU always-free).

```powershell
# from the repo root
aws s3api create-bucket --bucket pde-tfstate-<ACCOUNT_ID> --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1

aws s3api put-bucket-versioning --bucket pde-tfstate-<ACCOUNT_ID> --versioning-configuration Status=Enabled

aws s3api put-public-access-block --bucket pde-tfstate-<ACCOUNT_ID> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws dynamodb create-table --table-name pde-tfstate-lock --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region ap-south-1
```

Then uncomment the `backend "s3"` block in each environment's `backend.tf`,
set `bucket = pde-tfstate-<ACCOUNT_ID>`, and run `terraform init -reconfigure`
inside each environment directory.

Notes:

- Local state is the default; skip this if you deploy solo and keep state on
  your machine (do **not** commit `*.tfstate`).
- If you lose state but keep the AWS resources, `terraform import` is your
  friend — or just start over with a fresh environment name.
