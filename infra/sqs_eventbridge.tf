# ===================================================================
# SQS FIFO — Cola de eventos de pago
# ===================================================================

resource "aws_sqs_queue" "payment_events" {
  name                        = "tandasmx-payment-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = false  # Usamos MessageDeduplicationId explícito
  visibility_timeout_seconds  = 60
  message_retention_seconds   = 86400  # 1 día

  tags = { Name = "tandasmx-payment-events", Environment = var.environment }
}

# Permiso para que lambda_exec_role envíe y consuma mensajes de la cola
resource "aws_iam_role_policy" "sqs_payment_events" {
  name = "sqs-payment-events"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
      ]
      Resource = aws_sqs_queue.payment_events.arn
    }]
  })
}

# Trigger SQS → process_payment_events
resource "aws_lambda_event_source_mapping" "process_payment_events" {
  event_source_arn = aws_sqs_queue.payment_events.arn
  function_name    = aws_lambda_function.process_payment_events.arn
  batch_size       = 10
  enabled          = true
}

# ===================================================================
# EventBridge — Ejecución semanal (domingos 8am UTC = 2am México Central)
# ===================================================================

resource "aws_cloudwatch_event_rule" "weekly_score_update" {
  name                = "tandasmx-weekly-score-update"
  description         = "Recalcula eventos periódicos de score cada domingo"
  schedule_expression = "cron(0 8 ? * SUN *)"

  tags = { Name = "tandasmx-weekly-score-update", Environment = var.environment }
}

resource "aws_cloudwatch_event_target" "process_periodic_events" {
  rule      = aws_cloudwatch_event_rule.weekly_score_update.name
  target_id = "process-periodic-events"
  arn       = aws_lambda_function.process_periodic_events.arn
}

resource "aws_lambda_permission" "eventbridge_process_periodic_events" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_periodic_events.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_score_update.arn
}
