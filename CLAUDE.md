# TandasMX — Project Context for Claude Code

## Project Overview

TandasMX is a mobile fintech application for organizing **tandas** (rotating savings groups) in Mexico. Published on Google Play Store with active users. The app allows participants to manage tanda groups, track payments, and coordinate savings rounds.

- **Target market:** Mexico 🇲🇽
- **Platform:** Android (via Capacitor), Web
- **Store:** Google Play Store

---

## Tech Stack

### Frontend
- **React** — UI framework
- **Capacitor** — Native Android bridge
- **Custom Capacitor plugins** — Android-specific features

### Backend (AWS Serverless)
- **AWS Lambda** — Business logic functions
- **Amazon DynamoDB** — Primary database
- **Amazon API Gateway** — REST API layer
- **Amazon SES** — Email (forgot password flow, notifications)
- **AdMob** — Monetization (ads)
- **In-App Purchases** — Monetization

### Infrastructure
- **Terraform** — Infrastructure as Code (IaC)
- **AWS IAM cross-account roles** — Multi-account management

---

## Repository Structure

```
tandasmx/
├── app/                          # React + Capacitor frontend
│   ├── android/                  # Capacitor Android project
│   ├── dist/                     # Production build output
│   ├── node_modules/
│   ├── resources/                # App icons and splash screens
│   ├── src/                      # React source code
│   ├── capacitor.config.json
│   ├── capacitor.config.ts
│   ├── index.html
│   ├── INSTRUCCIONES.md          # App-specific dev notes
│   ├── package.json
│   ├── politica_privacidad.html  # Privacy policy (Google Play requirement)
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── backup/                       # DynamoDB backup snapshots (gzipped JSON)
│   ├── links_registro-*.json.gz
│   ├── notificaciones-*.json.gz
│   ├── pagos-*.json.gz
│   ├── participantes-*.json.gz
│   ├── tandas-*.json.gz
│   └── usuarios_admin-*.json.gz
├── infra/                        # Terraform — AWS infrastructure
│   ├── api_auth.tf               # API Gateway auth routes
│   ├── api_tanda.tf              # API Gateway tanda routes
│   ├── backup_system.tf          # Backup infrastructure
│   ├── lambdas.tf                # Lambda function definitions
│   ├── main.tf                   # Provider and backend config
│   ├── outputs.tf                # Terraform outputs
│   ├── tablas_dynamo.tf          # DynamoDB table definitions
│   ├── variables.tf              # Input variables
│   └── terraform.tfvars.example  # Example vars (never commit .tfvars)
├── lambdas/                      # Lambda function source code (Python)
│   ├── backup_system/
│   ├── lambda_auth/              # Authentication (login/register)
│   ├── lambda_authorizer/        # API Gateway custom authorizer (JWT)
│   ├── lambda_estadisticas/      # Analytics / feature usage stats
│   ├── lambda_notificaciones/    # Push/WhatsApp notifications
│   ├── lambda_pagos/             # Payment tracking
│   ├── lambda_participantes/     # Tanda participants management
│   ├── lambda_recovery/          # Forgot password (SES)
│   ├── lambda_tandas/            # Tanda group CRUD
│   ├── lambdas.tf                # Lambda-specific Terraform (shared with infra/)
│   └── requirements.txt          # Python dependencies
├── layers/                       # Lambda Layers
│   └── auth_layer/               # Shared auth utilities layer
│       ├── python/
│       └── requirements.txt
├── scripts/                      # Utility shell scripts
│   └── cleanup_mx_central.sh     # AWS resource cleanup script
└── .gitignore
```

---

## Key Features

- **Tanda management** — Create/join tanda groups, assign turns
- **Payment tracking** — Mark payments as paid/pending per participant
- **Authentication** — User login/register with forgot password (AWS SES)
- **WhatsApp integration** — Notifications for Mexican users
- **Calendar export** — Export tanda schedule to device calendar
- **Analytics** — Feature usage tracking

---

## Common Commands

### Frontend
```bash
npm install              # Install dependencies
npm run dev              # Local dev server
npm run build            # Production build
npx cap sync android     # Sync web assets to Android
npx cap open android     # Open Android Studio
```

### Infrastructure (Terraform)
```bash
terraform init           # Initialize providers
terraform plan           # Preview changes
terraform apply          # Deploy infrastructure
terraform destroy        # Tear down (use with caution)
```

---

## AWS Architecture Notes

- All Lambda functions use **Python 3.12** runtime (see `lambdas/requirements.txt`)
- DynamoDB tables use **single-table design** where possible
- API Gateway uses **REST API** (not HTTP API)
- Cross-account role switching configured for multi-account AWS management
- Infrastructure is being migrated to **personal AWS account**

### DynamoDB Key Tables
- `Users` — User accounts and profiles
- `Tandas` — Tanda group definitions
- `Participants` — Members per tanda
- `Payments` — Payment records per round

---

## Development Conventions

- Use **camelCase** for JavaScript/TypeScript variables and functions
- Lambda handlers follow pattern: `exports.handler = async (event) => {}`
- All API responses must include CORS headers for web compatibility
- DynamoDB operations use **AWS SDK v3** (`@aws-sdk/client-dynamodb`)
- Terraform resources named with prefix `tandasmx_`

---

## Environment Variables

Lambda functions use environment variables (never hardcode):
- `USERS_TABLE` — DynamoDB Users table name
- `TANDAS_TABLE` — DynamoDB Tandas table name
- `SES_FROM_EMAIL` — Sender email for SES
- `JWT_SECRET` — Auth token secret

---

## Current Work in Progress

- [ ] Monorepo migration (from mixed repo structure)
- [ ] AWS infrastructure migration to personal account
- [ ] Cross-account IAM role configuration
- [ ] Feature usage analytics implementation
- [ ] TikTok marketing content (@tanda.ahorro_)

---

## Important Notes for Claude

- This app targets **Mexican users** — UI text and notifications are in **Spanish**
- Payment amounts use **Mexican Peso (MXN)**
- WhatsApp is the primary communication channel for Mexican users (prefer over SMS)
- When modifying DynamoDB schemas, always check for existing data migration needs
- Terraform changes that affect API Gateway require **redeployment of the stage**
- Android builds require `npx cap sync` before opening in Android Studio