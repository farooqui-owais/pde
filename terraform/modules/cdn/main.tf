# =============================================================================
# main.tf - CloudFront CDN + TLS (ACM cert in us-east-1) and optional
# Route 53 hosted zone + alias records. CloudFront 1 TB egress + 10M reqs/mo
# is inside the free tier; PriceClass_100 keeps edge locations cheap.
# =============================================================================

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = "${var.environment_name}-pde"
  http_version    = "http2"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  origin {
    domain_name = var.origin_domain
    origin_id   = "pde-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  logging_config {
    bucket          = var.artifact_bucket_domain_name
    prefix          = "cloudfront-logs/"
    include_cookies = false
  }

  default_cache_behavior {
    target_origin_id       = "pde-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]

    # Cache policy forwards everything the SPA + API need (free managed policy).
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled

    # Origin request policy that forwards the Host/CSRF/auth headers.
    origin_request_policy_id = "59781a5b-3903-41f3-afcb-af6290cc0d4d" # AllViewerExceptHostHeader
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = [var.app_domain]

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-cdn"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

# Route 53 is NOT free-tier (billed per hosted zone + queries) - only create
# it when create_hosted_zone is explicitly true.
resource "aws_route53_zone" "this" {
  count = var.create_hosted_zone ? 1 : 0

  name = var.app_domain

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-zone"
    Environment = var.environment_name
    Project     = var.project_name
  })
}

resource "aws_route53_record" "app" {
  count = var.create_hosted_zone ? 1 : 0

  zone_id = aws_route53_zone.this[0].zone_id
  name    = var.app_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "app_www" {
  count = var.create_hosted_zone ? 1 : 0

  zone_id = aws_route53_zone.this[0].zone_id
  name    = "www.${var.app_domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
