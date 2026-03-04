# TandasMX 🏦

Aplicación móvil para organizar **tandas** (grupos de ahorro rotativo) en México. Disponible en Google Play Store.

> Repo privado — monorepo que contiene el frontend, las funciones Lambda y la infraestructura en AWS.

---

## Estructura del repositorio

```
tandasmx-app/
├── app/          # Frontend React + Capacitor (Android)
├── lambdas/      # Funciones AWS Lambda (Python)
├── layers/       # Lambda Layers compartidos
└── infra/        # Infraestructura Terraform (DynamoDB, API Gateway, SES)
```

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, TailwindCSS, Capacitor |
| Mobile | Android (Capacitor) |
| Backend | AWS Lambda (Python 3.12) |
| Base de datos | AWS DynamoDB |
| API | AWS API Gateway v2 (HTTP API) |
| Email | AWS SES |
| Notificaciones | AWS SNS |
| Infraestructura | Terraform |
| Estado Terraform | S3 backend remoto |
| Web estático | S3 Static Website Hosting |
| Región AWS | us-east-1 |

---

## Arquitectura AWS

```
  Browser / Android App
          │
          ▼
  ┌───────────────────────────────────────┐
  │           API Gateway v2              │
  │  /auth          → lambda-auth         │
  │  /tandas        → lambda-tandas       │
  │  /participantes → lambda-participantes│
  │  /pagos         → lambda-pagos        │
  │  /notificaciones→ lambda-notificaciones│
  │  /estadisticas  → lambda-estadisticas │
  │  (authorizer)   → lambda-authorizer   │
  └───────────────────────────────────────┘
          │
          ▼
   DynamoDB Tables
   ┌──────────────────────────┐
   │ tandas                   │
   │ participantes            │
   │ pagos                    │
   │ notificaciones           │
   │ usuarios_admin           │
   │ links_registro           │
   │ auth-password-reset-tokens│
   └──────────────────────────┘

  SES         → Emails transaccionales (forgot/reset password)
  SNS         → Notificaciones de backup y SMS
  S3          → Terraform state + backups DynamoDB + web estático
  EventBridge → Trigger automático de backups semanales
```

**Archivos Terraform por recurso:**
- `tablas_dynamo.tf` — Tablas DynamoDB
- `lambdas.tf` — Funciones Lambda, layers y permisos IAM
- `api_auth.tf` — API Gateway de autenticación
- `api_tanda.tf` — API Gateway de tandas
- `backup_system.tf` — Sistema de respaldo automático (S3 + EventBridge + SNS)
- `main.tf` — Provider, backend S3 y recursos globales (SES, SNS)

---

## Setup local

### Requisitos previos

- Node.js 18+
- Android Studio + SDK
- Terraform 1.x
- AWS CLI configurado con perfil válido
- Java (para jarsigner al firmar el bundle)

### 1. Clonar e instalar dependencias del frontend

```bash
cd app
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales:
# VITE_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/prod
# VITE_API_KEY=...
```

### 3. Correr en modo desarrollo (web)

```bash
cd app
npm run dev
```

### 4. Correr en Android

```bash
cd app
npm run build
npx cap sync android
npx cap open android
# Desde Android Studio: Run > Run 'app'
```

---

## Deploy

### Frontend → Play Store (nuevo bundle)

#### 1. Build del frontend y sincronización con Android

```bash
cd app
npm run build
npx cap sync android
```

#### 2. Incrementa la versión en `android/app/build.gradle`

Cada subida a Play Store requiere un `versionCode` mayor al anterior:

```gradle
android {
    defaultConfig {
        versionCode 3        # incrementar en 1 respecto a la versión anterior
        versionName "1.2.0"  # versión visible en Play Store
    }
}
```

#### 3. Genera el AAB desde línea de comandos

```bash
cd app/android
./gradlew bundleRelease
# El archivo queda en:
# app/build/outputs/bundle/release/app-release.aab
```

#### 4. Firma el bundle con jarsigner

El keystore está en `app/tanda-release-key.keystore`:

```bash
cd app/android

jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore app/tanda-release-key.keystore \
  app/build/outputs/bundle/release/app-release.aab \
  tanda-key
```

Te pedirá la contraseña del keystore. Al terminar verás `jar signed.`

#### 5. Verifica que el bundle quedó bien firmado

```bash
jarsigner -verify -verbose \
  app/build/outputs/bundle/release/app-release.aab
# Debe mostrar: jar verified.
```

#### 6. Sube a Play Store

El archivo firmado listo para subir está en:
```
app/android/app/build/outputs/bundle/release/app-release.aab
```

Ve a **Google Play Console → TandasMX → Producción → Crear nueva versión** y sube el `.aab`.

> ⚠️ Nunca subas `tanda-release-key.keystore` al repositorio. Agrégalo al `.gitignore` y guárdalo en un lugar seguro — si lo pierdes no podrás publicar actualizaciones de la app.

---

### Frontend → Web estático en S3

#### Primera vez (setup del bucket)

```bash
# 1. Crear el bucket
aws s3api create-bucket \
  --bucket tandasmx-app \
  --region us-east-1 \
  --profile tandasmx

# 2. Habilitar hosting estático
#    error-document apunta a index.html porque es una SPA (React Router)
aws s3 website s3://tandasmx-app \
  --index-document index.html \
  --error-document index.html \
  --profile tandasmx

# 3. Permitir acceso público
aws s3api put-public-access-block \
  --bucket tandasmx-app \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --profile tandasmx

aws s3api put-bucket-policy \
  --bucket tandasmx-app \
  --profile tandasmx \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tandasmx-app/*"
    }]
  }'
```

URL del sitio:
```
http://tandasmx-app.s3-website-us-east-1.amazonaws.com
```

#### Deploy (cada actualización)

```bash
cd app
npm run build
aws s3 sync dist/ s3://app-tandasmx --delete --profile tandasmx
```

> ⚠️ S3 static hosting sirve solo HTTP. Si necesitas HTTPS agrega CloudFront enfrente del bucket.

---

### Infraestructura Terraform

```bash
cd infra

# Primera vez o al cambiar de cuenta/región
terraform init -reconfigure

# Ver cambios antes de aplicar
AWS_PROFILE=tandasmx terraform plan -var-file="terraform.tfvars"

# Aplicar cambios
AWS_PROFILE=tandasmx terraform apply -var-file="terraform.tfvars"
```

> ⚠️ El estado de Terraform está en S3 (backend remoto). Nunca commitear archivos `.tfstate` al repo.

**Backend S3 configurado en `main.tf`:**
```hcl
terraform {
  backend "s3" {
    bucket       = "tandasmx-terraform-state"
    key          = "tandasmx/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
    profile      = "tandasmx"
  }
}
```

**Para crear el bucket del backend en una cuenta nueva:**
```bash
aws s3api create-bucket \
  --bucket tandasmx-terraform-state \
  --region us-east-1 \
  --profile tandasmx

aws s3api put-bucket-versioning \
  --bucket tandasmx-terraform-state \
  --versioning-configuration Status=Enabled \
  --profile tandasmx
```

### Variables de Terraform

```bash
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars está en .gitignore — nunca se sube al repo
```

---

## Migración de datos DynamoDB

En caso de necesitar migrar datos entre cuentas AWS sin acceso directo entre ellas:

**1. Descarga los backups manualmente** desde la consola de AWS → S3 → bucket de backups. Los archivos tienen el formato:
```
prod/YYYY/week-NN/nombre_tabla-YYYY-MM-DD.json.gz
```

**2. Guárdalos en una carpeta local:**
```
~/backups/
├── tandas-2025-02-20.json.gz
├── participantes-2025-02-20.json.gz
├── pagos-2025-02-20.json.gz
└── ...
```

**3. Corre el script de restauración** (disponible en `infra/scripts/restore_dynamo_local.py`):
```bash
pip install boto3
python restore_dynamo_local.py --folder ~/backups

# O para restaurar una tabla específica primero
python restore_dynamo_local.py --folder ~/backups --table usuarios_admin
```

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del API Gateway |
| `VITE_API_KEY` | API Key de API Gateway |

**Variables de Terraform** (`terraform.tfvars`):

| Variable | Descripción |
|---|---|
| `aws_region` | Región AWS (us-east-1) |
| `jwt_secret` | Secret para firmar JWT |
| `jwt_refresh_secret` | Secret para refresh tokens |
| `app_url` | URL pública de la app |
| `support_email` | Email verificado en SES para envíos |
| `frontend_url` | URL del frontend (para links en emails) |
| `token_expiration_hours` | Horas de vigencia del token de reset password |
| `environment` | Ambiente (prod, dev) |
| `notification_email` | Email para recibir notificaciones de backup |

---

## Screenshots

<!-- Agregar screenshots de la app aquí -->
> TODO: Agregar capturas de pantalla de las pantallas principales.

---

## Links útiles

- [Google Play Store](#) — *(agregar link)*
- [Política de privacidad](app/politica_privacidad.html)
- [Documentación Capacitor](https://capacitorjs.com/docs)
- [Documentación Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)