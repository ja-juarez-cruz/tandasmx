
# 4. Invocar backup manualmente
aws lambda invoke \
  --function-name tandas-dynamodb-backup-dev \
  --region us-east-1 \
  response.json


# 5. Restaurar backup (dry run)
python restore_dynamodb.py \
  --bucket tandas-backups-dev-123456789 \
  --date 2025-01-24 \
  --tables tables_config.json \
  --dry-run

  # 6. Restaurar backup (producción)
python restore_dynamodb.py \
  --bucket tandas-backups-production-123456789 \
  --date 2025-01-24 \
  --tables tables_config.json