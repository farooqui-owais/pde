# =============================================================================
# main.tf - IAM role + instance profile, JWT secret in SSM, EC2 app instance
# (Nginx + Gunicorn/FastAPI) with the bootstrap user-data, and an Elastic IP.
# =============================================================================

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "ec2" {
  name = "${var.environment_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      },
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-ec2-role"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "s3_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "cw_agent" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Read the DB password (and, below, store the JWT secret) from SSM.
resource "aws_iam_role_policy" "ssm_read" {
  name = "${var.environment_name}-ssm-read"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/pde/${var.environment_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData", "ec2:DescribeTags", "ec2:DescribeInstances"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.environment_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# JWT secret generated here and stored in a free SSM SecureString; the
# instance fetches it at boot. Never printed or committed anywhere.
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/pde/${var.environment_name}/jwt-secret"
  description = "JWT SECRET_KEY for the PDE ${var.environment_name} API (do not print)."
  type        = "SecureString"
  value       = random_password.jwt_secret.result

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-jwt-secret"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

# Latest Amazon Linux 2023 AMI, resolved per-region from SSM public params.
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_ami.value
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  monitoring             = false

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data_replace_on_change = false
  user_data = templatefile("${path.module}/templates/user_data.sh.tpl", {
    repo_url             = var.repo_url
    repo_branch          = var.repo_branch
    app_dir              = var.app_dir
    db_host              = var.db_host
    db_port              = var.db_port
    db_name              = var.db_name
    db_user              = var.db_user
    db_password_ssm_name = var.db_password_ssm_name
    jwt_secret_ssm_name  = aws_ssm_parameter.jwt_secret.name
    aws_region           = data.aws_region.current.name
    cors_origins         = var.cors_origins
    trusted_hosts        = var.trusted_hosts
    app_domain           = var.app_domain
  })

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-app"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

# Elastic IP: a stable origin for DNS / CloudFront. Free tier only keeps an
# EIP free while it is ATTACHED to a running instance - keep enable_eip=true
# and never leave it idled.
resource "aws_eip" "app" {
  count = var.enable_eip ? 1 : 0

  domain = "vpc"

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-app-eip"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_eip_association" "app" {
  count = var.enable_eip ? 1 : 0

  allocation_id = aws_eip.app[count.index].allocation_id
  instance_id   = aws_instance.app.id
}
