# ============================================================================
# Outputs del Módulo de Backup
# ============================================================================

output "backup_bucket_name" {
  description = "Nombre del bucket S3 donde se almacenan los backups"
  value       = aws_s3_bucket.backup_bucket.id
}

output "backup_bucket_arn" {
  description = "ARN del bucket S3 de backups"
  value       = aws_s3_bucket.backup_bucket.arn
}

output "backup_lambda_arn" {
  description = "ARN de la función Lambda que ejecuta los backups"
  value       = aws_lambda_function.backup_function.arn
}

output "backup_lambda_name" {
  description = "Nombre de la función Lambda"
  value       = aws_lambda_function.backup_function.function_name
}

output "backup_schedule" {
  description = "Expresión cron del schedule configurado"
  value       = var.backup_schedule
}

output "sns_topic_arn" {
  description = "ARN del SNS topic para notificaciones"
  value       = aws_sns_topic.backup_notifications.arn
}

output "cloudwatch_log_group" {
  description = "Nombre del CloudWatch Log Group de Lambda"
  value       = aws_cloudwatch_log_group.backup_lambda_logs.name
}

output "eventbridge_rule_name" {
  description = "Nombre de la regla EventBridge que programa los backups"
  value       = aws_cloudwatch_event_rule.backup_schedule.name
}

output "manual_invoke_command" {
  description = "Comando AWS CLI para invocar backup manualmente"
  value = <<-EOT
    aws lambda invoke \
      --function-name ${aws_lambda_function.backup_function.function_name} \
      --payload '{"date": "${formatdate("YYYY-MM-DD", timestamp())}"}' \
      --region ${var.backup_region} \
      response.json
  EOT
}

output "api_gateway_url" {
  description = "URL base del API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "forgot_password_endpoint" {
  description = "Endpoint completo para forgot password"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/auth/forgot-password"
}

output "reset_password_endpoint" {
  description = "Endpoint completo para reset password"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/auth/reset-password"
}

output "password_reset_tokens_table" {
  description = "Nombre de la tabla de tokens"
  value       = aws_dynamodb_table.password_reset_tokens.name
}

output "ses_email_verification_status" {
  description = "Email que debe ser verificado en SES"
  value       = "IMPORTANTE: Verificar ${var.support_email} en AWS SES antes de usar"
}

output "lambda_forgot_password_name" {
  description = "Nombre de la función Lambda forgot-password"
  value       = aws_lambda_function.forgot_password.function_name
}

output "lambda_reset_password_name" {
  description = "Nombre de la función Lambda reset-password"
  value       = aws_lambda_function.reset_password.function_name
}
