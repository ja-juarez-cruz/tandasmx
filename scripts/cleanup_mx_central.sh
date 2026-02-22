#!/bin/bash

# ============================================================================
# Script de limpieza de recursos TandasMX en mx-central-1
# Uso: bash cleanup_mx_central.sh
# ============================================================================

REGION="mx-central-1"
PROFILE="tandasmx"

echo "========================================"
echo "Limpiando recursos TandasMX en $REGION"
echo "========================================"

# ============================================================================
# LAMBDAS
# ============================================================================
echo ""
echo ">>> Eliminando Lambda Functions..."

LAMBDAS=(
  "lambda-auth"
  "lambda-tandas"
  "lambda-participantes"
  "lambda_pagos"
  "lambda-notificaciones"
  "tanda-manager-authorizer"
  "tanda_manager_estadisticas"
  "auth-forgot-password"
  "auth-reset-password"
  "auth-change-password"
  "tandas-dynamodb-backup-prod"
)

for fn in "${LAMBDAS[@]}"; do
  echo "  Eliminando Lambda: $fn"
  aws lambda delete-function \
    --function-name "$fn" \
    --region $REGION \
    --profile $PROFILE 2>/dev/null && echo "  ✓ $fn eliminada" || echo "  - $fn no encontrada, omitiendo"
done

# ============================================================================
# LAMBDA LAYERS
# ============================================================================
echo ""
echo ">>> Eliminando Lambda Layers..."

LAYER_VERSIONS=$(aws lambda list-layer-versions \
  --layer-name "auth-python-layer" \
  --region $REGION \
  --profile $PROFILE \
  --query 'LayerVersions[*].Version' \
  --output text 2>/dev/null)

for version in $LAYER_VERSIONS; do
  echo "  Eliminando Layer auth-python-layer version $version"
  aws lambda delete-layer-version \
    --layer-name "auth-python-layer" \
    --version-number "$version" \
    --region $REGION \
    --profile $PROFILE 2>/dev/null && echo "  ✓ Layer v$version eliminado" || echo "  - Layer v$version no encontrado"
done

# ============================================================================
# DYNAMODB
# ============================================================================
echo ""
echo ">>> Eliminando tablas DynamoDB..."

TABLES=(
  "tandas"
  "participantes"
  "pagos"
  "notificaciones"
  "usuarios_admin"
  "links_registro"
  "auth-password-reset-tokens"
)

for table in "${TABLES[@]}"; do
  echo "  Eliminando tabla: $table"
  aws dynamodb delete-table \
    --table-name "$table" \
    --region $REGION \
    --profile $PROFILE 2>/dev/null && echo "  ✓ $table eliminada" || echo "  - $table no encontrada, omitiendo"
done

# ============================================================================
# API GATEWAY
# ============================================================================
echo ""
echo ">>> Eliminando APIs en API Gateway..."

APIS=$(aws apigatewayv2 list-apis \
  --region $REGION \
  --profile $PROFILE \
  --query 'Items[?contains(Name, `tandamx`) || contains(Name, `tanda`)].ApiId' \
  --output text 2>/dev/null)

for api_id in $APIS; do
  echo "  Eliminando API: $api_id"
  aws apigatewayv2 delete-api \
    --api-id "$api_id" \
    --region $REGION \
    --profile $PROFILE 2>/dev/null && echo "  ✓ API $api_id eliminada" || echo "  - API $api_id no encontrada"
done

# ============================================================================
# SNS TOPICS
# ============================================================================
echo ""
echo ">>> Eliminando SNS Topics..."

SNS_TOPICS=$(aws sns list-topics \
  --region $REGION \
  --profile $PROFILE \
  --query 'Topics[*].TopicArn' \
  --output text 2>/dev/null)

for arn in $SNS_TOPICS; do
  if [[ $arn == *"tanda"* ]]; then
    echo "  Eliminando SNS Topic: $arn"
    aws sns delete-topic \
      --topic-arn "$arn" \
      --region $REGION \
      --profile $PROFILE 2>/dev/null && echo "  ✓ Topic eliminado" || echo "  - Topic no encontrado"
  fi
done

# ============================================================================
# S3 BUCKETS DE BACKUP
# ============================================================================
echo ""
echo ">>> Eliminando S3 buckets de backup..."

ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)
BACKUP_BUCKET="tandas-backups-prod-${ACCOUNT_ID}"

echo "  Vaciando bucket: $BACKUP_BUCKET"
aws s3 rm s3://$BACKUP_BUCKET --recursive \
  --region $REGION \
  --profile $PROFILE 2>/dev/null

echo "  Eliminando bucket: $BACKUP_BUCKET"
aws s3api delete-bucket \
  --bucket "$BACKUP_BUCKET" \
  --region $REGION \
  --profile $PROFILE 2>/dev/null && echo "  ✓ Bucket eliminado" || echo "  - Bucket no encontrado, omitiendo"

# ============================================================================
# IAM ROLES (globales, sin región)
# ============================================================================
echo ""
echo ">>> Eliminando IAM Roles..."

IAM_ROLES=(
  "lambda_exec_role_tandamx"
  "tandas-backup-lambda-role-prod"
  "tanda-manager-sns-delivery"
)

for role in "${IAM_ROLES[@]}"; do
  echo "  Desvinculando políticas del rol: $role"

  # Desvincular políticas adjuntas
  POLICIES=$(aws iam list-attached-role-policies \
    --role-name "$role" \
    --profile $PROFILE \
    --query 'AttachedPolicies[*].PolicyArn' \
    --output text 2>/dev/null)

  for policy_arn in $POLICIES; do
    aws iam detach-role-policy \
      --role-name "$role" \
      --policy-arn "$policy_arn" \
      --profile $PROFILE 2>/dev/null
  done

  # Eliminar políticas inline
  INLINE_POLICIES=$(aws iam list-role-policies \
    --role-name "$role" \
    --profile $PROFILE \
    --query 'PolicyNames[*]' \
    --output text 2>/dev/null)

  for policy_name in $INLINE_POLICIES; do
    aws iam delete-role-policy \
      --role-name "$role" \
      --policy-name "$policy_name" \
      --profile $PROFILE 2>/dev/null
  done

  # Eliminar el rol
  aws iam delete-role \
    --role-name "$role" \
    --profile $PROFILE 2>/dev/null && echo "  ✓ Rol $role eliminado" || echo "  - Rol $role no encontrado, omitiendo"
done

# ============================================================================
# IAM POLICIES CUSTOM
# ============================================================================
echo ""
echo ">>> Eliminando IAM Policies custom..."

ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)

POLICIES=(
  "arn:aws:iam::${ACCOUNT_ID}:policy/dynamodb_rw_policy_tandamx"
)

for policy_arn in "${POLICIES[@]}"; do
  echo "  Eliminando policy: $policy_arn"
  aws iam delete-policy \
    --policy-arn "$policy_arn" \
    --profile $PROFILE 2>/dev/null && echo "  ✓ Policy eliminada" || echo "  - Policy no encontrada, omitiendo"
done

# ============================================================================
# CLOUDWATCH LOG GROUPS
# ============================================================================
echo ""
echo ">>> Eliminando CloudWatch Log Groups..."

LOG_GROUPS=$(aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/" \
  --region $REGION \
  --profile $PROFILE \
  --query 'logGroups[*].logGroupName' \
  --output text 2>/dev/null)

for lg in $LOG_GROUPS; do
  if [[ $lg == *"tanda"* ]] || [[ $lg == *"auth-"* ]] || [[ $lg == *"lambda-"* ]]; then
    echo "  Eliminando Log Group: $lg"
    aws logs delete-log-group \
      --log-group-name "$lg" \
      --region $REGION \
      --profile $PROFILE 2>/dev/null && echo "  ✓ $lg eliminado" || echo "  - $lg no encontrado"
  fi
done

echo ""
echo "========================================"
echo "✓ Limpieza completada"
echo "Verifica en la consola de AWS que no"
echo "queden recursos huerfanos en $REGION"
echo "========================================"
