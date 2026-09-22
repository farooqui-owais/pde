# =============================================================================
# main.tf - encrypted + versioned S3 bucket for media / backups / artifacts.
# Public access fully blocked; TLS-only enforced by bucket policy. Retained
# on destroy (like the CloudFormation DeletionPolicy: Retain) so data is not
# lost when the stack is torn down.
# =============================================================================

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "artifacts" {
  # Bucket name must be globally unique -> account id suffix.
  bucket = "${var.environment_name}-${data.aws_caller_identity.current.account_id}-artifacts"

  # Terraform >= 4 no longer allows inline policy/versioning/encryption blocks.
  # DeletionPolicy: Retain is expressed by NOT destroying data on destroy;
  # force_destroy = false keeps the bucket (and contents) after `destroy`.
  force_destroy = false

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-artifacts"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "ExpireOldVersions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }

  # Keep CloudFront logs from outgrowing the 5 GB free tier.
  dynamic "rule" {
    for_each = var.enable_cloudfront_logging ? [1] : []
    content {
      id     = "ExpireCloudFrontLogs"
      status = "Enabled"
      filter {
        prefix = "cloudfront-logs/"
      }
      expiration {
        days = 30
      }
    }
  }
}

resource "aws_s3_bucket_policy" "enforce_tls" {
  bucket = aws_s3_bucket.artifacts.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.artifacts]
}
