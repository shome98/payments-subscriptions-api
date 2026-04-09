# 💳 Payments & Subscriptions API

A production-ready, multi-tenant payments and subscriptions microservice built with Node.js, Express, TypeScript, and Drizzle ORM. Supports **Razorpay**, **Stripe**, and **PayPal** with webhook handling, refund management, and tier-based subscription limits.

> 🔗 Part of the CrudFactory ecosystem — integrates with `personal-auth-api` for JWT authentication and `crud-factory-api` for API creation limits.

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🔐 Authentication & Authorization](#-authentication--authorization)
- [📡 API Reference](#-api-reference)
- [💳 Payment Providers](#-payment-providers)
- [🪝 Webhooks](#-webhooks)
- [🗄️ Database Schema](#️-database-schema)
- [⚙️ Configuration](#️-configuration)
- [🧪 Development](#-development)
- [🐳 Docker](#-docker)
- [🔒 Security](#-security)
- [📊 Monitoring & Logging](#-monitoring--logging)
- [🤝 Contributing](#-contributing)

---

## ✨ Features

### Core Functionality
- ✅ **Tier Management**: Create, update, and manage subscription tiers (Free, Pro, Enterprise) with customizable limits and permissions
- ✅ **Discount System**: Promo codes with percentage discounts, validity windows, usage limits, and tier-specific applicability
- ✅ **Subscription Tracking**: Per-user subscription state with `limitLeft` counter for API creation quotas
- ✅ **Multi-Provider Payments**: Unified interface for Razorpay (INR), Stripe (USD), and PayPal (multi-currency)
- ✅ **Refund Management**: Admin-initiated and webhook-triggered refunds with partial/full support and automatic subscription downgrade
- ✅ **Webhook Handling**: Idempotent, signature-verified webhooks for payment events across all providers
- ✅ **Audit Logging**: Append-only `payment_audit_log` and `subscription_usage_log` tables for compliance and debugging

### Integration Features
- 🔗 **Internal Service API**: `/api/v1/internal/*` endpoints for CRUD Factory to check/decrement user API creation limits
- 🔗 **JWT Shared Auth**: Uses same `JWT_SECRET` as `personal-auth-api` — no redundant auth service
- 🔗 **Cross-Service User Reference**: `userId` references external auth service (no physical FK)

### Operational Excellence
- 🛡️ **Security**: Helmet, CORS, rate limiting, timing-safe comparisons, signature verification
- 📈 **Observability**: Winston logging with daily rotation, structured JSON in production, correlation IDs
- 🧪 **Validation**: Zod schemas for all inputs with detailed error responses
- 🔄 **Graceful Shutdown**: Handles SIGTERM/SIGINT with 10s timeout fallback
- 🩺 **Health Checks**: `/healthz` (liveness) and `/readyz` (readiness) endpoints

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js 20 (Alpine) |
| **Framework** | Express 5 |
| **Language** | TypeScript 5 |
| **ORM** | Drizzle ORM + postgres-js |
| **Database** | PostgreSQL 16 (Alpine) |
| **Auth** | JWT (jsonwebtoken) |
| **Validation** | Zod |
| **Logging** | Winston + winston-daily-rotate-file |
| **Security** | Helmet, express-rate-limit, crypto |
| **Dev Tools** | tsx, nodemon, drizzle-kit |
| **Containerization** | Docker + Docker Compose |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (optional, recommended)
- PostgreSQL 16+ (if running locally without Docker)

### 1. Clone & Install
```bash
git clone https://github.com/shome98/payments-subscriptions-api.git
cd payments-subscriptions-api
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration (see ⚙️ Configuration section)
```

### 3. Database Setup
```bash
# Generate Drizzle migration files
npm run db:generate

# Run migrations (requires DATABASE_URL)
npm run db:migrate

# Or push schema directly (development only)
npm run db:push
```

### 4. Start the Server
```bash
# Development (with hot reload + auto-migrations)
npm run dev

# Production build
npm run build
npm start
```

### 5. Verify
```bash
curl http://localhost:9880/healthz
# Response: {"success":true,"message":"💚 Payments & Subscriptions API is healthy!",...}
```

---

## 🔐 Authentication & Authorization

### JWT Authentication (User Routes)
- **Token Source**: Issued by `personal-auth-api`
- **Header**: `Authorization: Bearer <token>` or `Cookie: access_token=<token>`
- **Payload Fields**:
  ```ts
  {
    userId: string;    // PG users.id UUID
    role: 'user' | 'admin';
    sessionToken: string;
    jti: string;       // JWT ID for blocklist support
  }
  ```

### Internal Service Auth (CRUD Factory)
- **Header**: `X-Internal-API-Key: <INTERNAL_API_KEY>`
- **Purpose**: Service-to-service calls without JWT overhead
- **Endpoints**: `/api/v1/internal/*`

### Admin Authorization
- Requires valid JWT **AND** `role: "admin"`
- Middleware: `authenticate` → `requireAdmin`
- Endpoints: `/api/v1/admin/*`

### 🛠️ Development Bypass (Local Only)
When `NODE_ENV=development` and `DEV_BYPASS_ENABLED=true`:
```bash
# Skip JWT verification with header
curl -H "X-Dev-User-Id: <uuid>" \
     -H "X-Dev-Role: admin" \
     http://localhost:9880/api/v1/subscriptions/me
```
> ⚠️ **Never enable in production** — hard-coded `NODE_ENV` check prevents bypass.

---

## 📡 API Reference

### Base URL
```
http://localhost:9880/api/v1
```

### Public Routes (No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tiers` | List active subscription tiers (paginated) |
| `GET` | `/tiers/:id` | Get single tier by ID |
| `POST` | `/tiers/by-ids` | Batch fetch tiers by IDs |
| `GET` | `/discounts/validate?code=XYZ&tierId=uuid` | Validate discount code |

### User Routes (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/subscriptions/me` | Get current user's subscription |
| `POST` | `/payments/razorpay/create-order` | Create Razorpay order |
| `POST` | `/payments/razorpay/verify` | Verify Razorpay payment signature |
| `GET` | `/payments/razorpay/history` | Get user's Razorpay payment history |
| `POST` | `/payments/stripe/create-session` | Create Stripe Checkout session |
| `GET` | `/payments/stripe/success?session_id=xyz` | Handle Stripe success callback |
| `GET` | `/payments/stripe/cancel` | Handle Stripe cancel callback |
| `GET` | `/payments/stripe/history` | Get user's Stripe payment history |
| `POST` | `/payments/paypal/create-order` | Create PayPal order |
| `POST` | `/payments/paypal/capture/:orderId` | Capture approved PayPal order |
| `GET` | `/payments/paypal/history` | Get user's PayPal payment history |
| `GET` | `/payments/refunds/me` | Get user's refund history |

### Admin Routes (JWT + Admin Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/tiers` | List all tiers (paginated) |
| `POST` | `/admin/tiers` | Create new tier |
| `PATCH` | `/admin/tiers/:id` | Update tier |
| `DELETE` | `/admin/tiers/:id` | Delete tier |
| `GET` | `/admin/discounts` | List all discounts |
| `POST` | `/admin/discounts` | Create discount code |
| `PATCH` | `/admin/discounts/:id` | Update discount |
| `DELETE` | `/admin/discounts/:id` | Delete discount |
| `GET` | `/admin/subscriptions` | List all user subscriptions |
| `PATCH` | `/admin/subscriptions/:id` | Update subscription |
| `GET` | `/admin/payments?provider=stripe` | List payments by provider |
| `POST` | `/admin/refunds/razorpay/:paymentId` | Initiate Razorpay refund |
| `POST` | `/admin/refunds/stripe/:paymentId` | Initiate Stripe refund |
| `POST` | `/admin/refunds/paypal/:paymentId` | Initiate PayPal refund |
| `GET` | `/admin/refunds` | List all refunds |
| `GET` | `/admin/refunds/:refundId` | Get refund details |

### Internal Routes (X-Internal-API-Key)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/internal/subscriptions/check/:userId` | Check if user can create API + tier info |
| `POST` | `/internal/subscriptions/decrement/:userId` | Decrement API creation limit after successful creation |

### Webhook Routes (Signature Verified)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webhooks/razorpay` | Razorpay webhook (raw body + `X-Razorpay-Signature`) |
| `POST` | `/webhooks/stripe` | Stripe webhook (raw buffer + `Stripe-Signature`) |
| `POST` | `/webhooks/paypal` | PayPal webhook (JSON payload) |

### Utility Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/healthz` | Liveness probe |
| `GET` | `/readyz` | Readiness probe |

---

## 💳 Payment Providers

### Razorpay (INR)
```env
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```
- Amounts stored in **paise** (₹1 = 100 paise)
- Signature verification: `HMAC-SHA256(orderId|paymentId, keySecret)`
- Webhook events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`

### Stripe (USD)
```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:5173/payment/success
STRIPE_CANCEL_URL=http://localhost:5173/payment/cancel
```
- Amounts stored in **cents** ($1 = 100 cents)
- Uses Checkout Sessions + PaymentIntents
- Webhook signature verification via Stripe SDK

### PayPal (Multi-currency)
```env
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```
- Amounts stored as **decimal strings** (e.g., `"10.99"`)
- OAuth2 client credentials flow for API access
- Webhook events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`

---

## 🪝 Webhooks

### Idempotency
All webhooks use the `webhook_events` table to prevent duplicate processing:
- Unique constraint: `(provider, event_id)`
- Events older than 30 days still logged but not reprocessed (`WEBHOOK_IDEMPOTENCY_WINDOW_DAYS`)

### Signature Verification
| Provider | Header | Verification Method |
|----------|--------|-------------------|
| Razorpay | `X-Razorpay-Signature` | HMAC-SHA256 of raw body |
| Stripe | `Stripe-Signature` | Stripe SDK `constructEvent()` |
| PayPal | *(None)* | Trusted via PayPal IPN + event ID deduplication |

### Response Behavior
- ✅ Success: `200 OK` with `{"success": true, ...}`
- ⚠️ Logic errors: Still return `200` to prevent provider retries (errors logged internally)
- ❌ Signature failures: Return `400 Bad Request`

---

## 🗄️ Database Schema

### Core Tables
```
tiers
├─ id (uuid, pk)
├─ name (varchar, unique)          # "Free", "Pro", "Enterprise"
├─ price (numeric)                 # Decimal price
├─ limit (integer)                 # Max APIs user can create
├─ permission (enum)               # SCRUD, SCRUDQ, MCRUD, MCRUDQ
├─ benefits (jsonb)                # ["3 APIs", "Priority support"]
└─ is_active (boolean)

discounts
├─ id (uuid, pk)
├─ tier_id (fk → tiers.id)
├─ code (varchar, unique)          # "LAUNCH50"
├─ discount_percentage (numeric)   # 20.00 = 20%
├─ final_price (numeric)           # Pre-computed for quick display
├─ valid_from / valid_until (timestamp)
├─ max_uses / used_count (integer) # 0 = unlimited
└─ is_active (boolean)

user_subscriptions
├─ id (uuid, pk)
├─ user_id (uuid)                  # References external auth service
├─ tier_id (fk → tiers.id)
├─ is_subscribed (boolean)
├─ status (enum)                   # active, expired, cancelled, pending
├─ limit_left (integer)            # Remaining API creation slots
├─ expires_at / cancelled_at (timestamp)
└─ auto_renew (boolean)
```

### Payment Tables (Provider-Specific)
```
razorpay_payments  │  stripe_payments  │  paypal_payments
├─ id (uuid)       │  ├─ id (uuid)     │  ├─ id (uuid)
├─ user_id         │  ├─ user_id       │  ├─ user_id
├─ tier_id         │  ├─ tier_id       │  ├─ tier_id
├─ status (enum)   │  ├─ status (enum) │  ├─ status (enum)
├─ razorpay_order_id│ ├─ stripe_session_id│ ├─ paypal_order_id
├─ razorpay_payment_id│ ├─ stripe_payment_intent_id│ ├─ paypal_capture_id
├─ amount (integer: paise)│ ├─ amount (integer: cents)│ ├─ amount (numeric: decimal)
├─ currency        │  ├─ currency      │  ├─ currency
├─ discount_id     │  ├─ discount_id   │  ├─ discount_id
├─ refunded_amount │  ├─ refunded_amount│ ├─ refunded_amount
└─ metadata (jsonb)│  └─ metadata      │  └─ metadata
```

### Audit & Utility Tables
```
refunds                  │  webhook_events              │  payment_audit_log
├─ id (uuid)             │  ├─ id (uuid)                │  ├─ id (uuid)
├─ user_id / payment_id  │  ├─ provider (enum)          │  ├─ user_id
├─ provider (enum)       │  ├─ event_id (unique)        │  ├─ payment_id
├─ provider_refund_id    │  ├─ event_type               │  ├─ provider (enum)
├─ amount / currency     │  ├─ status (enum)            │  ├─ action (enum)
├─ is_partial (boolean)  │  ├─ payload (jsonb)          │  ├─ previous/new_status
├─ status (enum)         │  └─ processed_at             │  ├─ note / payload
├─ initiated_by (enum)   │                              │  └─ created_at
└─ metadata (jsonb)      │                              │
                         │                              │
subscription_usage_log   │
├─ id (uuid)             │
├─ user_id / api_id      │
├─ action (decrement/reset)│
├─ limit_before / after  │
└─ created_at            │
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)
```env
# Server
PORT=9880
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Auth (must match personal-auth-api)
JWT_SECRET=your_jwt_secret_minimum_32_characters_here
INTERNAL_API_KEY=your_internal_api_key_here

# CORS
CLIENT_URL=http://localhost:5173,http://localhost:3000

# Security
ENCRYPTION_KEY=your_32_char_encryption_key_here_
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:5173/payment/success
STRIPE_CANCEL_URL=http://localhost:5173/payment/cancel

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# Dev Tools (development only)
DEV_BYPASS_ENABLED=false
```

> 🔐 **Security Note**: `JWT_SECRET` and `INTERNAL_API_KEY` must be at least 32 and 16 characters respectively. Use a secure generator.

---

## 🧪 Development

### Scripts (`package.json`)
```json
{
  "scripts": {
    "dev": "npm run docker:pre-run && nodemon",
    "build": "tsc --build",
    "start": "node dist/api/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "docker:pre-run": "npm run db:generate && npm run db:migrate"
  }
}
```

### Hot Reload
- Uses `nodemon` + `tsx` for TypeScript execution without compilation
- Watches `src/` directory, ignores `.spec.ts` and `dist/`
- Configured via `nodemon.json`

### Database Studio
```bash
npm run db:studio
# Opens Drizzle Studio at http://localhost:3000
```

### Testing Webhooks Locally
Use [ngrok](https://ngrok.com) to expose your local server:
```bash
ngrok http 9880
# Update webhook URLs in provider dashboards to https://<ngrok-url>/api/v1/webhooks/*
```

---

## 🐳 Docker

### Docker Compose Setup
```yaml
# docker-compose.yml highlights
services:
  app:
    build: .
    ports: ["9880:9880"]
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume to protect container modules
      - ./logs/:/app/logs
    depends_on:
      postgres-db_payments-subs-api:
        condition: service_healthy

  postgres-db_payments-subs-api:
    image: postgres:16-alpine
    ports: ["5491:5432"]  # Host:Container
    volumes:
      - ./api-payments-subs_db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d api-payments-subs_db"]
```

### Start with Docker
```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Dockerfile Highlights
- Multi-stage build with `node:20-alpine`
- Non-root user (`api-payments-subs-user`) for security
- Layer caching optimized: `package*.json` copied before source code
- Logs directory pre-created with correct permissions
- Default command: `npm run dev` (hot reload)

### .dockerignore
Excludes `node_modules`, `dist`, `.env`, logs, and database data to keep builds fast and secure.

---

## 🔒 Security

### Implemented Measures
| Feature | Implementation |
|---------|--------------|
| **Input Validation** | Zod schemas with strict typing and coercion |
| **SQL Injection** | Drizzle ORM parameterized queries |
| **XSS/Clickjacking** | Helmet middleware (CSP, X-Frame-Options, etc.) |
| **Rate Limiting** | `express-rate-limit` with per-endpoint configs |
| **CORS** | Configurable origins via `CLIENT_URL` env var |
| **JWT Security** | Signature + expiry verification; timing-safe token comparison |
| **Webhook Security** | Provider-specific signature verification |
| **Secret Management** | Environment variables; no hardcoded secrets |
| **Error Handling** | Generic 500 errors in production; detailed in dev |
| **Non-Root Container** | Docker user isolation |

### Timing-Safe Comparisons
Used for:
- Internal API key validation (`timingSafeCompare`)
- Razorpay signature verification (`crypto.timingSafeEqual`)

Prevents timing attacks on secret comparisons.

### PostgreSQL Security
- SSL enforced in production (`ssl: 'require'`)
- Connection pooling with `max: 10`, idle/connect timeouts
- Migrations run with single-connection client to avoid race conditions

---

## 📊 Monitoring & Logging

### Winston Logger Configuration
```ts
// Development: Human-readable, colorized
2024-06-15 14:30:22 [info]: GET /api/v1/tiers 200 - 45ms { "userId": "abc...", "apiId": "xyz..." }

// Production: Structured JSON
{"level":"info","message":"GET /api/v1/tiers 200 - 45ms","timestamp":"2024-06-15T14:30:22.123Z","userId":"abc..."}
```

### Log Files (Daily Rotation)
```
logs/
├── error-2024-06-15.log    # ERROR level only
├── combined-2024-06-15.log # All levels
└── ... (retained for 14 days, zipped)
```

### Correlation IDs
- Auto-generated UUID per request (`X-Request-Id` header)
- Client can provide custom ID via `X-Request-Id` (validated against pattern)
- Included in all log entries for traceability

### Health Checks
```bash
# Liveness (is process running?)
GET /healthz
→ 200: {"status":"ok","environment":"development","uptime":"123s"}

# Readiness (is app ready for traffic?)
GET /readyz  
→ 200: {"status":"ok",...} # Extend with DB/connection checks if needed
```

---

## 🤝 Contributing

### Project Structure
```
src/
├── api/                  # Entry point (api/index.ts)
├── config/               # Env validation, constants
├── controllers/          # Request handlers (thin layer)
├── services/             # Business logic (thick layer)
├── routes/               # Express routers
├── middleware/           # Auth, validation, error handling
├── validators/           # Zod schemas
├── utils/                # Helpers (crypto, logger, api-response)
├── db/
│   ├── schema/           # Drizzle table definitions
│   ├── index.ts          # DB connection export
│   └── migrate.ts        # Migration runner
└── types/                # TypeScript declarations (Express augmentation)
```

### Code Standards
- **TypeScript**: Strict mode enabled (`tsconfig.json`)
- **Error Handling**: Use `ApiError` class for operational errors; let unexpected errors bubble to global handler
- **Logging**: Use `logger` utility; include `userId`/`apiId` in context when available
- **Database**: Always use Drizzle; avoid raw SQL unless necessary
- **Tests**: Add `.spec.ts` files (currently placeholder; expand with Jest/Vitest)

### Adding a New Payment Provider
1. Add provider enum to `src/config/constants.ts`
2. Create schema file in `src/db/schema/payments-<provider>.ts`
3. Implement service in `src/services/<provider>.service.ts`
4. Add controller + routes with validation
5. Implement webhook handler in `src/services/webhook.service.ts`
6. Update refund service to support new provider
7. Add environment variables to `.env.example`

### PR Checklist
- [ ] Zod validation for all new endpoints
- [ ] Rate limiting applied appropriately
- [ ] Webhook signature verification (if applicable)
- [ ] Audit log entries for state-changing operations
- [ ] TypeScript types exported for new schemas
- [ ] Environment variables documented in `.env.example`
- [ ] Health check readiness extended if new dependency added

---

## 📄 License

ISC © [Sowparna Shome](https://github.com/shome98)

---

> 💡 **Pro Tip**: Use `drizzle-kit studio` during development to visually inspect your schema and run ad-hoc queries without leaving the terminal.

*Last updated: March 2026* 🚀