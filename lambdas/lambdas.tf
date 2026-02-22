# -------------------------------------------------------------------
# Rol para Lambda
# -------------------------------------------------------------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_exec_role_tandamx"

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
}

resource "aws_iam_role_policy_attachment" "lambda_exec" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -------------------------------------------------------------------
# Política de IAM para acceso a DynamoDB
# -------------------------------------------------------------------
resource "aws_iam_policy" "dynamodb_rw_policy" {
  name        = "dynamodb_rw_policy_tandamx"
  description = "Política para acceso de lectura/escritura a tablas de DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/tandas",
          "arn:aws:dynamodb:*:*:table/tandas/index/*",
          "arn:aws:dynamodb:*:*:table/participantes",
          "arn:aws:dynamodb:*:*:table/participantes/index/*",
          "arn:aws:dynamodb:*:*:table/pagos",
          "arn:aws:dynamodb:*:*:table/pagos/index/*",
          "arn:aws:dynamodb:*:*:table/notificaciones",
          "arn:aws:dynamodb:*:*:table/notificaciones/index/*",
          "arn:aws:dynamodb:*:*:table/usuarios_admin",
          "arn:aws:dynamodb:*:*:table/usuarios_admin/index/*",
          "arn:aws:dynamodb:*:*:table/links_registro",
          "arn:aws:dynamodb:*:*:table/links_registro/index/*",
          "arn:aws:dynamodb:*:*:table/auth-password-reset-tokens",
          "arn:aws:dynamodb:*:*:table/auth-password-reset-tokens/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_ses" {
  name = "lambda-ses"
  role = aws_iam_role.lambda_exec_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# -------------------------------------------------------------------
# Adjuntar la política dynamo al rol de Lambda
# -------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.dynamodb_rw_policy.arn
}


# -------------------------------------------------------------------
# Layer: AUTH
# Ruta anterior: ${path.module}/src/layers/auth_layer/
# Ruta nueva:    ${path.module}/../layers/auth_layer/
# -------------------------------------------------------------------
resource "null_resource" "lambda_layer_build" {
  triggers = {
    requirements = filemd5("${path.module}/../layers/auth_layer/requirements.txt")
  }

  provisioner "local-exec" {
    command = <<EOT
      mkdir -p ${path.module}/../layers/auth_layer/python
      python3 -m pip install -r ${path.module}/../layers/auth_layer/requirements.txt \
        -t ${path.module}/../layers/auth_layer/python --upgrade
    EOT
  }
}

data "archive_file" "auth_layer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../layers/auth_layer"
  output_path = "${path.module}/build/auth_layer.zip"
  depends_on  = [null_resource.lambda_layer_build]
}

resource "aws_lambda_layer_version" "auth_layer" {
  layer_name          = "auth-python-layer"
  filename            = data.archive_file.auth_layer_zip.output_path
  source_code_hash    = data.archive_file.auth_layer_zip.output_base64sha256
  compatible_runtimes = ["python3.11", "python3.12"]
  description         = "Lambda Layer auth"
}


# ========================================
# ZIPS DE LAS LAMBDAS
# Ruta anterior: ${path.module}/src/lambdas/<nombre>/
# Ruta nueva:    ${path.module}/../lambdas/<nombre>/
# Los zips se generan en infra/build/
# ========================================

data "archive_file" "lambda_auth" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_auth"
  output_path = "${path.module}/build/lambda_auth.zip"
}

data "archive_file" "lambda_tandas" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_tandas"
  output_path = "${path.module}/build/lambda_tandas.zip"
}

data "archive_file" "lambda_participantes" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_participantes"
  output_path = "${path.module}/build/lambda_participantes.zip"
}

data "archive_file" "lambda_pagos" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_pagos"
  output_path = "${path.module}/build/lambda_pagos.zip"
}

data "archive_file" "lambda_notificaciones" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_notificaciones"
  output_path = "${path.module}/build/lambda_notificaciones.zip"
}

data "archive_file" "lambda_authorizer" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_authorizer"
  output_path = "${path.module}/build/lambda_authorizer.zip"
}

data "archive_file" "lambda_estadisticas" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/lambda_estadisticas"
  output_path = "${path.module}/build/lambda_estadisticas.zip"
}

data "archive_file" "forgot_password" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/lambda_recovery/forgot_password.py"
  output_path = "${path.module}/build/lambda_forgot_password.zip"
}

data "archive_file" "reset_password" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/lambda_recovery/reset_password.py"
  output_path = "${path.module}/build/lambda_reset_password.zip"
}

data "archive_file" "change_password" {
  type        = "zip"
  source_file = "${path.module}/../lambdas/lambda_recovery/change_password.py"
  output_path = "${path.module}/build/lambda_change_password.zip"
}


# -------------------------------------------------------------------
# Lambda: AUTENTICACIÓN
# -------------------------------------------------------------------
resource "aws_lambda_function" "lambda_auth" {
  filename         = data.archive_file.lambda_auth.output_path
  function_name    = "lambda-auth"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_auth.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      USUARIOS_TABLE     = "usuarios_admin"
      JWT_SECRET         = var.jwt_secret
      JWT_REFRESH_SECRET = var.jwt_refresh_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "lambda_auth" }
}


# -------------------------------------------------------------------
# Lambda: TANDAS
# -------------------------------------------------------------------
resource "aws_lambda_function" "lambda_tandas" {
  filename         = data.archive_file.lambda_tandas.output_path
  function_name    = "lambda-tandas"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_tandas.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TANDAS_TABLE        = aws_dynamodb_table.tandas.name
      USUARIOS_TABLE      = aws_dynamodb_table.usuarios_admin.name
      PARTICIPANTES_TABLE = aws_dynamodb_table.participantes.name
      PAGOS_TABLE         = aws_dynamodb_table.pagos.name
      JWT_SECRET          = var.jwt_secret
      APP_URL             = var.app_url
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "lambda-tanda" }
}


# -------------------------------------------------------------------
# Lambda: PARTICIPANTES
# -------------------------------------------------------------------
resource "aws_lambda_function" "lambda_participantes" {
  filename         = data.archive_file.lambda_participantes.output_path
  function_name    = "lambda-participantes"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_participantes.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TANDAS_TABLE        = aws_dynamodb_table.tandas.name
      PARTICIPANTES_TABLE = aws_dynamodb_table.participantes.name
      JWT_SECRET          = var.jwt_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "lambda-participantes" }
}


# -------------------------------------------------------------------
# Lambda: PAGOS
# -------------------------------------------------------------------
resource "aws_lambda_function" "lambda_pagos" {
  filename         = data.archive_file.lambda_pagos.output_path
  function_name    = "lambda_pagos"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_pagos.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TANDAS_TABLE        = aws_dynamodb_table.tandas.name
      PARTICIPANTES_TABLE = aws_dynamodb_table.participantes.name
      PAGOS_TABLE         = aws_dynamodb_table.pagos.name
      JWT_SECRET          = var.jwt_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "lambda_pagos" }
}


# -------------------------------------------------------------------
# Lambda: NOTIFICACIONES
# -------------------------------------------------------------------
resource "aws_lambda_function" "lambda_notificaciones" {
  filename         = data.archive_file.lambda_notificaciones.output_path
  function_name    = "lambda-notificaciones"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_notificaciones.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TANDAS_TABLE         = aws_dynamodb_table.tandas.name
      PARTICIPANTES_TABLE  = aws_dynamodb_table.participantes.name
      NOTIFICACIONES_TABLE = aws_dynamodb_table.notificaciones.name
      JWT_SECRET           = var.jwt_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "lambda-notificaciones" }
}


# -------------------------------------------------------------------
# Lambda: AUTHORIZER
# -------------------------------------------------------------------
resource "aws_lambda_function" "authorizer" {
  filename         = data.archive_file.lambda_authorizer.output_path
  function_name    = "tanda-manager-authorizer"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_authorizer.handler"
  source_code_hash = data.archive_file.lambda_authorizer.output_base64sha256
  runtime          = "python3.12"
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      JWT_SECRET = var.jwt_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "tanda-manager-authorizer" }
}


# -------------------------------------------------------------------
# Lambda: ESTADÍSTICAS
# -------------------------------------------------------------------
resource "aws_lambda_function" "estadisticas" {
  filename         = data.archive_file.lambda_estadisticas.output_path
  function_name    = "tanda_manager_estadisticas"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda_estadisticas.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TANDAS_TABLE        = aws_dynamodb_table.tandas.name
      PARTICIPANTES_TABLE = aws_dynamodb_table.participantes.name
      PAGOS_TABLE         = aws_dynamodb_table.pagos.name
      JWT_SECRET          = var.jwt_secret
    }
  }

  layers = [aws_lambda_layer_version.auth_layer.arn]

  tags = { Name = "tanda-manager-estadisticas" }
}


# -------------------------------------------------------------------
# Lambda: FORGOT PASSWORD
# -------------------------------------------------------------------
resource "aws_lambda_function" "forgot_password" {
  filename         = data.archive_file.forgot_password.output_path
  function_name    = "auth-forgot-password"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "forgot_password.handler"
  source_code_hash = data.archive_file.forgot_password.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  layers = [aws_lambda_layer_version.auth_layer.arn]

  environment {
    variables = {
      USERS_TABLE_NAME        = aws_dynamodb_table.usuarios_admin.name
      RESET_TOKENS_TABLE_NAME = aws_dynamodb_table.password_reset_tokens.name
      SUPPORT_EMAIL           = var.support_email
      FRONTEND_URL            = var.frontend_url
      TOKEN_EXPIRATION_HOURS  = tostring(var.token_expiration_hours)
    }
  }

  tags = {
    Name        = "auth-forgot-password"
    Environment = var.environment
  }
}


# -------------------------------------------------------------------
# Lambda: RESET PASSWORD
# -------------------------------------------------------------------
resource "aws_lambda_function" "reset_password" {
  filename         = data.archive_file.reset_password.output_path
  function_name    = "auth-reset-password"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "reset_password.handler"
  source_code_hash = data.archive_file.reset_password.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  layers = [aws_lambda_layer_version.auth_layer.arn]

  environment {
    variables = {
      USERS_TABLE_NAME        = aws_dynamodb_table.usuarios_admin.name
      RESET_TOKENS_TABLE_NAME = aws_dynamodb_table.password_reset_tokens.name
    }
  }

  tags = {
    Name        = "auth-reset-password"
    Environment = var.environment
  }
}


# -------------------------------------------------------------------
# Lambda: CHANGE PASSWORD
# -------------------------------------------------------------------
resource "aws_lambda_function" "change_password" {
  filename         = data.archive_file.change_password.output_path
  function_name    = "auth-change-password"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "change_password.handler"
  source_code_hash = data.archive_file.change_password.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  layers = [aws_lambda_layer_version.auth_layer.arn]

  environment {
    variables = {
      USERS_TABLE_NAME        = aws_dynamodb_table.usuarios_admin.name
      RESET_TOKENS_TABLE_NAME = aws_dynamodb_table.password_reset_tokens.name
      JWT_SECRET              = var.jwt_secret
    }
  }

  tags = {
    Name        = "auth-change-password"
    Environment = var.environment
  }
}
