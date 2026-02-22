# --------------------------------------------
# Proveedor de AWS en la región especificada
# Se usa el profile "terraform" de AWS CLI, creado con aws configure
# --------------------------------------------
provider "aws" {
  region = var.aws_region
  profile = "tandasmx"
  default_tags {
    tags = var.tags
  }
}

terraform {
  backend "s3" {
    bucket         = "tandasmx-terraform-state"
    key            = "tandasmx/terraform.tfstate"
    region         = "us-east-1"
    encrypt      = true
    use_lockfile = true
    profile = "tandasmx"
  }
}

# Policy para SNS (envío de SMS)
resource "aws_iam_role_policy" "lambda_sns_policy" {
  name = "lambda-sns-tandamx-policy"
  role = aws_iam_role.lambda_exec_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:SetSMSAttributes",
          "sns:GetSMSAttributes"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}


# ========================================
# SNS TOPIC PARA SMS (OPCIONAL)
# ========================================

# Si quieres usar un Topic en lugar de enviar directo
resource "aws_sns_topic" "tanda_notifications" {
  name         = "tanda-manager-notifications"
  display_name = "Tanda Manager Notifications"
  
  tags = {
    Name = "tanda-manager-notifications"
  }
}

# Configuración de SMS predeterminada
#resource "aws_sns_sms_preferences" "default" {
#  default_sms_type         = "Transactional"  # o "Promotional"
#  delivery_status_iam_role_arn = aws_iam_role.sns_delivery_status.arn
  
  # Configuración para México
#  default_sender_id = "TandaMgr"  # Máximo 11 caracteres
  
  # Budget mensual en USD (0.50 por SMS en México)
#  monthly_spend_limit = "10"  # Máximo $100/mes en SMS
#}

# Role para delivery status de SNS
resource "aws_iam_role" "sns_delivery_status" {
  name = "tanda-manager-sns-delivery"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "sns_delivery_status" {
  name = "sns-delivery-status-policy"
  role = aws_iam_role.sns_delivery_status.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:PutMetricFilter",
          "logs:PutRetentionPolicy"
        ]
        Resource = "*"
      }
    ]
  })
}

# =======================
# SES: Verificación de email
# =======================
resource "aws_ses_email_identity" "support_email" {
  email = var.support_email
}


