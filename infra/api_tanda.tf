# ========================================
# API GATEWAY HTTP API
# ========================================

resource "aws_apigatewayv2_api" "main" {
  name          = "tandamx-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
  
  tags = {
    Name = "tandamx-api"
  }
}

# Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
  
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
  
  tags = {
    Name = "tandamx-api-stage"
  }
}

# CloudWatch Log Group para API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/api-gateway/tandamx-api"
  retention_in_days = 7
  
  tags = {
    Name = "tandamx-api-logs"
  }
}

# ========================================
# INTEGRACIONES CON LAMBDAS
# ========================================

# Proxy to lambda
resource "aws_apigatewayv2_integration" "tandas" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.lambda_tandas.invoke_arn
  payload_format_version = "2.0"
}

# POST /tandas
resource "aws_apigatewayv2_route" "tandas_crear" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /tandas/{tandaId}
resource "aws_apigatewayv2_route" "tandas_obtener" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
}

#PUT /tandas/{tandaId}
resource "aws_apigatewayv2_route" "tandas_actualizar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /tandas/{tandaId}"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas
resource "aws_apigatewayv2_route" "tandas_listar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#DELETE /tandas/{tandaId}
resource "aws_apigatewayv2_route" "tandas_eliminar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /tandas/{tandaId}"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#POST /tandas/{tandaId}/registro-link
resource "aws_apigatewayv2_route" "generar_link_registro" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas/{tandaId}/registro-link"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /registro/{token}
resource "aws_apigatewayv2_route" "obtener_datos_registro" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /registro/{token}"
  target    = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  # Sin autorización (pública)
}

#GET /tandas/{tandaId}/registro-link/activo
resource "aws_apigatewayv2_route" "obtener_link_vigente" {
  api_id = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/registro-link/activo"
  target = "integrations/${aws_apigatewayv2_integration.tandas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#Permiso para invocar lambda
resource "aws_lambda_permission" "tandas" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_tandas.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}



# API-Lambda integration
resource "aws_apigatewayv2_integration" "participantes" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.lambda_participantes.invoke_arn
  payload_format_version = "2.0"
}

#POST /tandas/{tandaId}/participantes
resource "aws_apigatewayv2_route" "participantes_crear" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas/{tandaId}/participantes"
  target    = "integrations/${aws_apigatewayv2_integration.participantes.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas/{tandaId}/participantes
resource "aws_apigatewayv2_route" "participantes_listar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/participantes"
  target    = "integrations/${aws_apigatewayv2_integration.participantes.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#PUT /tandas/{tandaId}/participantes/{participanteId}
resource "aws_apigatewayv2_route" "participantes_actualizar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /tandas/{tandaId}/participantes/{participanteId}"
  target    = "integrations/${aws_apigatewayv2_integration.participantes.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}


#DELETE /tandas/{tandaId}/participantes/{participanteId}
resource "aws_apigatewayv2_route" "participantes_eliminar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /tandas/{tandaId}/participantes/{participanteId}"
  target    = "integrations/${aws_apigatewayv2_integration.participantes.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#POST /registro/{token}
resource "aws_apigatewayv2_route" "registrar_participante_publico" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /registro/{token}"
  target    = "integrations/${aws_apigatewayv2_integration.participantes.id}"
  # Sin autorización (pública)
}

#Permiso para poder invocar lambda 
resource "aws_lambda_permission" "participantes" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_participantes.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}


# API-Lambda Integration
resource "aws_apigatewayv2_integration" "pagos" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.lambda_pagos.invoke_arn
  payload_format_version = "2.0"
}

# POST /tandas/{tandaId}/pagos
resource "aws_apigatewayv2_route" "pagos_crear" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas/{tandaId}/pagos"
  target    = "integrations/${aws_apigatewayv2_integration.pagos.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas/{tandaId}/pagos
resource "aws_apigatewayv2_route" "pagos_obtener" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/pagos"
  target    = "integrations/${aws_apigatewayv2_integration.pagos.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas/{tandaId}/pagos/matriz
resource "aws_apigatewayv2_route" "pagos_obtener_matriz" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/pagos/matriz"
  target    = "integrations/${aws_apigatewayv2_integration.pagos.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#PUT /tandas/{tandaId}/pagos/{pagoId}
resource "aws_apigatewayv2_route" "pagos_actualizar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /tandas/{tandaId}/pagos/{pagoId}"
  target    = "integrations/${aws_apigatewayv2_integration.pagos.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#Permiso para poder invocar lambda
resource "aws_lambda_permission" "pagos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_pagos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}


# API-Lambda intergration
resource "aws_apigatewayv2_integration" "notificaciones" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.lambda_notificaciones.invoke_arn
  payload_format_version = "2.0"
}

#POST /tandas/{tandaId}/notificaciones/recordatorio
resource "aws_apigatewayv2_route" "notificaciones_recordatorio" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas/{tandaId}/notificaciones/recordatorio"
  target    = "integrations/${aws_apigatewayv2_integration.notificaciones.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#POST /tandas/{tandaId}/notificaciones/recordatorio-masivo
resource "aws_apigatewayv2_route" "notificaciones_recordatorio_masivo" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /tandas/{tandaId}/notificaciones/recordatorio-masivo"
  target    = "integrations/${aws_apigatewayv2_integration.notificaciones.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas/{tandaId}/notificaciones
resource "aws_apigatewayv2_route" "notificaciones_obtener" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/notificaciones"
  target    = "integrations/${aws_apigatewayv2_integration.notificaciones.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#Permiso para poder invocar lambda
resource "aws_lambda_permission" "notificaciones" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_notificaciones.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}


# API-Lambda integration
resource "aws_apigatewayv2_integration" "estadisticas" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.estadisticas.invoke_arn
  payload_format_version = "2.0"
}

#GET /tandas/{tandaId}/estadisticas
resource "aws_apigatewayv2_route" "estadisticas" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/estadisticas"
  target    = "integrations/${aws_apigatewayv2_integration.estadisticas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /tandas/{tandaId}/reporte
resource "aws_apigatewayv2_route" "reportes" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tandas/{tandaId}/reporte"
  target    = "integrations/${aws_apigatewayv2_integration.estadisticas.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#Permiso para poder invocar el lambda
resource "aws_lambda_permission" "estadisticas" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.estadisticas.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API-Lambda integrations
resource "aws_apigatewayv2_integration" "update_score_event" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.update_score_event.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_score" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_score.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_leaderboard" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_leaderboard.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "check_tanda_access" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.check_tanda_access.invoke_arn
  payload_format_version = "2.0"
}

# Routes
#POST /score/events
resource "aws_apigatewayv2_route" "post_score_events" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /score/events"
  target             = "integrations/${aws_apigatewayv2_integration.update_score_event.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /score/{userId}
resource "aws_apigatewayv2_route" "get_score" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /score/{userId}"
  target             = "integrations/${aws_apigatewayv2_integration.get_score.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /score/leaderboard
resource "aws_apigatewayv2_route" "get_leaderboard" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /score/leaderboard"
  target             = "integrations/${aws_apigatewayv2_integration.get_leaderboard.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#GET /score/{userId}/access/{tandaId}
resource "aws_apigatewayv2_route" "check_tanda_access" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /score/{actorId}/access/{tandaId}"
  target             = "integrations/${aws_apigatewayv2_integration.check_tanda_access.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Permisos para invocar lambdas desde API Gateway
resource "aws_lambda_permission" "apigw_update_score_event" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_score_event.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_get_score" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_score.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_get_leaderboard" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_leaderboard.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_check_tanda_access" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.check_tanda_access.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API-Lambda integration
resource "aws_apigatewayv2_integration" "sync_payment_scores" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sync_payment_scores.invoke_arn
  payload_format_version = "2.0"
}

# POST /score/sync
resource "aws_apigatewayv2_route" "sync_payment_scores" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /score/sync"
  target             = "integrations/${aws_apigatewayv2_integration.sync_payment_scores.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "apigw_sync_payment_scores" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_payment_scores.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API-Lambda integration
resource "aws_apigatewayv2_integration" "webhook_pagos" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhook_pagos.invoke_arn
  payload_format_version = "2.0"
}

# POST /webhooks/pagos
resource "aws_apigatewayv2_route" "webhook_pagos" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /webhooks/pagos"
  target             = "integrations/${aws_apigatewayv2_integration.webhook_pagos.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "apigw_webhook_pagos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_pagos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API-Lambda integration
resource "aws_apigatewayv2_integration" "get_tanda_scores" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_tanda_scores.invoke_arn
  payload_format_version = "2.0"
}

# GET /tandas/{tandaId}/scores
resource "aws_apigatewayv2_route" "get_tanda_scores" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /tandas/{tandaId}/scores"
  target             = "integrations/${aws_apigatewayv2_integration.get_tanda_scores.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "apigw_get_tanda_scores" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_tanda_scores.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}