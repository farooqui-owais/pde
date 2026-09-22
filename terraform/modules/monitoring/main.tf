# =============================================================================
# main.tf - CloudWatch log group for the app, plus SNS email alarms
# (CPU high, instance status failed, DB low free storage).
# =============================================================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/pde/${var.environment_name}/app"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-app-log-group"
    Environment = var.environment_name
  })
}

# --- Alarms + SNS are only created when an alert email is provided -----------
resource "aws_sns_topic" "alerts" {
  count        = var.alert_email != "" ? 1 : 0
  name         = "${var.environment_name}-alerts"
  display_name = "PDE ${var.environment_name} alerts"

  tags = merge(var.tags, {
    Name        = "${var.environment_name}-alerts"
    Environment = var.environment_name
  })
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "ec2_cpu" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${var.environment_name}-app-cpu"
  alarm_description   = "High CPU on the app instance"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Average"
  threshold           = var.ec2_cpu_alarm_threshold
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions = {
    InstanceId = var.app_instance_id
  }
  alarm_actions = [aws_sns_topic.alerts[0].arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_status" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${var.environment_name}-app-status"
  alarm_description   = "Instance status check failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Maximum"
  threshold           = 1
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  treat_missing_data  = "breaching"
  dimensions = {
    InstanceId = var.app_instance_id
  }
  alarm_actions = [aws_sns_topic.alerts[0].arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "db_free_storage" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${var.environment_name}-db-storage"
  alarm_description   = "Low free storage on the database"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Average"
  threshold           = var.db_free_storage_alarm_threshold
  treat_missing_data  = "notBreaching"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }
  alarm_actions = [aws_sns_topic.alerts[0].arn]

  tags = var.tags
}
