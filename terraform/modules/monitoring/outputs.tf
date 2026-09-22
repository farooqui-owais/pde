output "app_log_group_name" {
  description = "CloudWatch log group for the app."
  value       = aws_cloudwatch_log_group.app.name
}

output "alert_topic_arn" {
  description = "SNS topic ARN for alarms (null when no alert email)."
  value       = var.alert_email != "" ? aws_sns_topic.alerts[0].arn : null
}

output "alarm_names" {
  description = "Names of the created CloudWatch alarms."
  value       = var.alert_email != "" ? [for a in concat(aws_cloudwatch_metric_alarm.ec2_cpu, aws_cloudwatch_metric_alarm.ec2_status, aws_cloudwatch_metric_alarm.db_free_storage) : a.alarm_name] : []
}
