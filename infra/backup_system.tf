# ============================================================================
# Sistema de Backup Automatizado para DynamoDB
# ============================================================================
#
# Este módulo de Terraform despliega una solución completa de backup para
# tablas DynamoDB con las siguientes características:
#
# - Backups automáticos programables via EventBridge
# - Almacenamiento comprimido en S3 con lifecycle policies
# - Notificaciones SNS de éxito/error
# - Encriptación en reposo
# - Versionamiento de backups
# - Soporte para cross-region y cross-account restore
#
# Componentes:
#   1. S3 Bucket con políticas de lifecycle y encriptación
#   2. Lambda Function para ejecutar backups
#   3. EventBridge Rule para programación
#   4. SNS Topic para notificaciones
#   5. IAM Roles y Policies necesarios
#
# Autor: Jose - Senior SOA Architect
# Versión: 1.0
# ============================================================================


# ============================================================================
# Data Sources
# ============================================================================

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ============================================================================
# S3 Bucket para Backups
# ============================================================================

resource "aws_s3_bucket" "backup_bucket" {
  bucket = "tandas-backups-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "TandasMX Backups - ${var.environment}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backup_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_encryption" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {
      prefix = "${var.environment}/"
    }

    transition {
      days          = var.retention_days
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {
      prefix = "${var.environment}/"
    }

    expiration {
      days = 30
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backup_bucket_public_access" {
  bucket = aws_s3_bucket.backup_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================================================
# SNS Topic para Notificaciones
# ============================================================================

resource "aws_sns_topic" "backup_notifications" {
  name              = "tandas-backup-notifications-${var.environment}"
  display_name      = "TandasMX Backup Notifications"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Name        = "TandasMX Backup Notifications"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "backup_email" {
  count     = var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.backup_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

resource "aws_sns_topic_policy" "backup_notifications_policy" {
  arn = aws_sns_topic.backup_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.backup_notifications.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# ============================================================================
# IAM Role y Policies para Lambda
# ============================================================================

resource "aws_iam_role" "backup_lambda_role" {
  name = "tandas-backup-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "TandasMX Backup Lambda Role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "backup_lambda_dynamodb_policy" {
  name = "dynamodb-access"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          for table in var.tables_config :
          "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${table.name}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "backup_lambda_s3_policy" {
  name = "s3-access"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.backup_bucket.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_bucket.arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "backup_lambda_sns_policy" {
  name = "sns-publish"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "backup_lambda_logs_policy" {
  name = "cloudwatch-logs"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# ============================================================================
# Lambda Function para Backup
# ============================================================================

data "archive_file" "backup_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/backup_system/backup_function.py"
  output_path = "${path.module}/build/backup_function.zip"
}

resource "aws_lambda_function" "backup_function" {
  filename         = data.archive_file.backup_lambda_zip.output_path
  function_name    = "tandas-dynamodb-backup-${var.environment}"
  role             = aws_iam_role.backup_lambda_role.arn
  handler          = "backup_function.lambda_handler"
  source_code_hash = data.archive_file.backup_lambda_zip.output_base64sha256
  runtime          = "python3.12"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory

  environment {
    variables = {
      BACKUP_BUCKET = aws_s3_bucket.backup_bucket.id
      ENVIRONMENT   = var.environment
      TABLES_CONFIG = jsonencode(var.tables_config)
      SNS_TOPIC_ARN = aws_sns_topic.backup_notifications.arn
    }
  }

  tags = {
    Name        = "TandasMX Backup Function"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "backup_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.backup_function.function_name}"
  retention_in_days = 30

  tags = {
    Name        = "TandasMX Backup Lambda Logs"
    Environment = var.environment
  }
}

# ============================================================================
# EventBridge Rule para Programación Automática
# ============================================================================

resource "aws_cloudwatch_event_rule" "backup_schedule" {
  name                = "tandas-backup-schedule-${var.environment}"
  description         = "Trigger backup semanal de DynamoDB para TandasMX"
  schedule_expression = var.backup_schedule
  state               = "ENABLED"

  tags = {
    Name        = "TandasMX Backup Schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "backup_lambda_target" {
  rule      = aws_cloudwatch_event_rule.backup_schedule.name
  target_id = "BackupLambdaTarget"
  arn       = aws_lambda_function.backup_function.arn

  input = jsonencode({
    source    = "eventbridge-schedule"
    automated = true
  })
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_function.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.backup_schedule.arn
}

# ============================================================================
# CloudWatch Alarms para Monitoreo
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "backup_lambda_errors" {
  alarm_name          = "tandas-backup-lambda-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alerta cuando Lambda de backup tiene errores"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.backup_function.function_name
  }

  alarm_actions = [aws_sns_topic.backup_notifications.arn]

  tags = {
    Name        = "TandasMX Backup Lambda Errors"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "backup_lambda_duration" {
  alarm_name          = "tandas-backup-lambda-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.lambda_timeout * 1000 * 0.9
  alarm_description   = "Alerta cuando backup se acerca al timeout"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.backup_function.function_name
  }

  alarm_actions = [aws_sns_topic.backup_notifications.arn]

  tags = {
    Name        = "TandasMX Backup Lambda Duration"
    Environment = var.environment
  }
}
