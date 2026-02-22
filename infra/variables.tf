# Región donde se desplegará la infraestructura en AWS
variable "aws_region" {
  default = "us-east-1"
}

variable "jwt_secret" {
  default = "TJw9FAgTyf8D0XEFeJRSgQeuBKFt8UpTDQaCLK5ZoX0="
}

variable "jwt_refresh_secret" {
  default = "Q1pEfyOgpMYEmwxeOQu+1k/eX+FZCnms2ZS5T/Z2Oh"
}

variable "app_url" {
  default = "http://localhost:3000"
}

# ============================================================================
# Variables de Configuración para Sistema de Backup DynamoDB
# ============================================================================
# 
# Este archivo define todas las variables configurables para el sistema
# de backup automático de DynamoDB a S3.
#
# Autor: Jose - Senior SOA Architect
# Versión: 1.0
# ============================================================================

variable "environment" {
  description = "Ambiente de deployment (production, staging, development)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["production", "staging", "development","dev"], var.environment)
    error_message = "Environment debe ser: production, staging, dev o development."
  }
}

variable "backup_schedule" {
  description = <<-EOT
    Expresión cron para programar backups automáticos.
    Formato EventBridge: cron(minutos horas día mes día-semana año)
    Ejemplos:
      - Domingos 2 AM UTC: cron(0 2 ? * SUN *)
      - Diario 3 AM UTC: cron(0 3 * * ? *)
      - Cada 6 horas: cron(0 */6 * * ? *)
  EOT
  type        = string
  default     = "cron(0 2 ? * SUN *)"
}

variable "tables_config" {
  description = <<-EOT
    Configuración de tablas DynamoDB a respaldar.
    
    Estructura de cada tabla:
      - name: Nombre de la tabla en DynamoDB (requerido)
      - pk: Nombre del atributo que es partition key (requerido)
      - sk: Nombre del atributo que es sort key (opcional)
      - attributes: Lista de atributos a incluir en backup (opcional, default: todos)
      - target_name: Nombre destino al restaurar (opcional, default: mismo nombre)
    
    Ejemplo:
      [{
        name       = "tandas"
        pk         = "tandaId"
        sk         = null
        attributes = null
      }]
  EOT
  
  type = list(object({
    name       = string
    pk         = string
    sk         = optional(string)
    attributes = optional(list(string))
  }))
  
  default = [
    {
      name = "tandas"
      pk   = "id"
      sk   = null
    },
    {
      name = "participantes"
      pk   = "id"
      sk   = "participanteId"
    },
    {
      name = "pagos"
      pk   = "id"
      sk   = "pagoId"
    },
    {
      name = "links_registro"
      pk   = "token"
      sk   = null
    },
    {
      name = "notificaciones"
      pk   = "id"
      sk   = null
    },
    {
      name = "usuarios_admin"
      pk   = "id"
      sk   = null
    },
  ]
}

variable "retention_days" {
  description = <<-EOT
    Número de días que los backups permanecen en S3 Standard antes
    de ser movidos automáticamente a S3 Glacier para storage de largo plazo.
    
    Recomendaciones:
      - 30 días: Para ambientes de desarrollo
      - 90 días: Para ambientes de staging
      - 180 días: Para ambientes de producción
  EOT
  type        = number
  default     = 90
  
  validation {
    condition     = var.retention_days >= 30 && var.retention_days <= 365
    error_message = "Retention days debe estar entre 30 y 365 días."
  }
}

variable "backup_region" {
  description = "Región AWS donde se almacenarán los backups"
  type        = string
  default     = "us-east-1"
}

variable "notification_email" {
  description = <<-EOT
    Email para recibir notificaciones de backups.
    Se creará un SNS topic y se enviará email de confirmación.
    Dejar vacío para deshabilitar notificaciones por email.
  EOT
  type        = string
  default     = "ja.juarez.cruz@gmail.com"
}

variable "lambda_timeout" {
  description = "Timeout de la función Lambda en segundos (max: 900)"
  type        = number
  default     = 900
  
  validation {
    condition     = var.lambda_timeout >= 60 && var.lambda_timeout <= 900
    error_message = "Lambda timeout debe estar entre 60 y 900 segundos."
  }
}

variable "lambda_memory" {
  description = "Memoria asignada a Lambda en MB (incrementos de 64 MB)"
  type        = number
  default     = 512
  
  validation {
    condition     = var.lambda_memory >= 128 && var.lambda_memory <= 10240
    error_message = "Lambda memory debe estar entre 128 y 10240 MB."
  }
}

variable "enable_s3_replication" {
  description = "Habilitar replicación cross-region de backups a región secundaria"
  type        = bool
  default     = false
}

variable "replication_region" {
  description = "Región destino para replicación (solo si enable_s3_replication = true)"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Tags comunes a aplicar a todos los recursos"
  type        = map(string)
  default = {
    Project   = "TandasMX"
    ManagedBy = "Terraform"
    Purpose   = "DynamoDB Backup System"
  }
}

variable "support_email" {
  description = "Email para enviar notificaciones (debe ser verificado en SES)"
  type        = string
  default     = "tandamx.soporte@gmail.com"
}

variable "frontend_url" {
  description = "URL del frontend para generar links de reset"
  type        = string
  default     = "https://app-tandamx.s3.us-east-1.amazonaws.com/index.html#"
}

variable "token_expiration_hours" {
  description = "Horas de validez del token de reset"
  type        = number
  default     = 24
}
