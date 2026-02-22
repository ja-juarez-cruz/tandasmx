# Tabla tandas
resource "aws_dynamodb_table" "tandas" {
  name           = "tandas"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "adminId"
    type = "S"
  }

  global_secondary_index {
    name            = "adminId-index"
    hash_key        = "adminId"
    projection_type = "ALL"
  }
  
  tags = {
    Name        = "tandas"
    Environment = "dev"
    Project     = "tandas"
  }
}


# Tabla participantes
resource "aws_dynamodb_table" "participantes" {
  name           = "participantes"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "participanteId"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "participanteId"
    type = "S"
  }
  
  tags = {
    Name        = "participantes"
    Environment = "dev"
    Project     = "participantes"
  }
}


# Tabla pagos
resource "aws_dynamodb_table" "pagos" {
  name           = "pagos"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "pagoId"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "pagoId"
    type = "S"
  }
  
  tags = {
    Name        = "pagos"
    Environment = "dev"
    Project     = "pagos"
  }
}


# Tabla notificaciones
resource "aws_dynamodb_table" "notificaciones" {
  name           = "notificaciones"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  tags = {
    Name        = "notificaciones"
    Environment = "dev"
    Project     = "notificaciones"
  }
}


# Tabla usuarios_admin
resource "aws_dynamodb_table" "usuarios_admin" {
  name           = "usuarios_admin"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  
  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
  
  tags = {
    Name        = "usuarios_admin"
    Environment = "dev"
    Project     = "usuarios_admin"
  }
}

# Nueva tabla: links_registro
resource "aws_dynamodb_table" "links_registro" {
  name           = "links_registro"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "token"

  attribute {
    name = "token"
    type = "S"
  }

  attribute {
    name = "tandaId"
    type = "S"
  }

  # Index para buscar por tandaId
  global_secondary_index {
    name            = "tandaId-index"
    hash_key        = "tandaId"
    projection_type = "ALL"
  }

  # TTL para auto-eliminación
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "TandasLinksRegistro"
    Environment = var.environment
  }
}


# =======================
# DynamoDB: Tabla para tokens de reset
# =======================
resource "aws_dynamodb_table" "password_reset_tokens" {
  name           = "auth-password-reset-tokens"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "token"

  attribute {
    name = "token"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  # GSI para búsqueda por email
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  # TTL para expiración automática de tokens
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Name        = "auth-password-reset-tokens"
    Environment = var.environment
  }
}