# ========================================
# AUTHORIZER
# ========================================

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.authorizer.invoke_arn
  identity_sources = ["$request.header.Authorization"]
  name             = "lambda-authorizer"  
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
}

# Permiso para que API Gateway invoque el Lambda Authorizer
resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ========================================
# INTEGRACIONES CON LAMBDAS
# ========================================

# API-Lambda integration
resource "aws_apigatewayv2_integration" "auth" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.lambda_auth.invoke_arn
  payload_format_version = "2.0"
}

#POST /auth/login
resource "aws_apigatewayv2_route" "auth_login" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

#POST /auth/register
resource "aws_apigatewayv2_route" "auth_register" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

#PUT /auth/register
resource "aws_apigatewayv2_route" "put_auth_register" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

#POST /auth/refresh
resource "aws_apigatewayv2_route" "auth_refresh" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/refresh"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

#DELETE /auth/account
resource "aws_apigatewayv2_route" "delete_account" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /auth/account"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

# Permiso para poder invocar el lambda
resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

#API-Lambda integration
resource "aws_apigatewayv2_integration" "forgot_password" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.forgot_password.invoke_arn
  payload_format_version = "2.0"
}

#POST /auth/forgot-password
resource "aws_apigatewayv2_route" "forgot_password" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/forgot-password"
  target    = "integrations/${aws_apigatewayv2_integration.forgot_password.id}"
}

# Permiso para poder invocar el lambda
resource "aws_lambda_permission" "apigw_forgot_password" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.forgot_password.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

#API-Lambda integration
resource "aws_apigatewayv2_integration" "reset_password" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.reset_password.invoke_arn
  payload_format_version = "2.0"
}

#POST /auth/reset-password
resource "aws_apigatewayv2_route" "reset_password" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/reset-password"
  target    = "integrations/${aws_apigatewayv2_integration.reset_password.id}"
}

#Permiso para poder invocar el lambda
resource "aws_lambda_permission" "apigw_reset_password" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reset_password.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

#API-Lambda integration
resource "aws_apigatewayv2_integration" "change_password" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.change_password.invoke_arn
  payload_format_version = "2.0"
}

#POST /auth/change-password
resource "aws_apigatewayv2_route" "change_password" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/change-password"
  target    = "integrations/${aws_apigatewayv2_integration.change_password.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

#Permiso para poder invocar el lambda
resource "aws_lambda_permission" "apigw_change_password" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.change_password.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}



