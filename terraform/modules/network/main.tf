# =============================================================================
# main.tf - free-tier VPC: public app subnet + private DB subnets.
# No NAT Gateway and no ALB (both are paid) - the private subnets have no
# default route, so RDS stays completely off the internet.
# =============================================================================
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  instance_tenancy     = "default"

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment_name}-vpc"
      Environment = var.environment_name
      Project     = var.project_name
    },
  )
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.environment_name}-igw" })
}

# Public subnet for the app instance
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-public-subnet"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

# Two private subnets (different AZs) required by RDS subnet groups
resource "aws_subnet" "db" {
  count = 2

  vpc_id                  = aws_vpc.this.id
  cidr_block              = element([var.db_subnet_cidr, var.db_subnet_cidr_2], count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-db-subnet-${count.index + 1}"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.environment_name}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Private route table with NO default route -> RDS stays off the internet
# and we do NOT need a (paid) NAT gateway.
resource "aws_route_table" "db" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.environment_name}-db-rt" })
}

resource "aws_route_table_association" "db" {
  count = 2

  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db.id
}

# --- Security groups ---------------------------------------------------------

resource "aws_security_group" "web" {
  name_prefix = "${var.environment_name}-web-sg"
  description = "Allow HTTP/HTTPS from internet, SSH from allowed CIDR"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP (Nginx / CloudFront origin)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH (restrict to your IP in prod)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_ingress_cidr]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.environment_name}-web-sg" })
}

resource "aws_security_group" "db" {
  name_prefix = "${var.environment_name}-db-sg"
  description = "Allow Postgres 5432 from the web SG only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Postgres from app servers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.environment_name}-db-sg" })
}
