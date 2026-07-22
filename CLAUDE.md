# AI Agent Instructions for PaySwift

Welcome to the PaySwift repository! You are an AI Agent operating on the PaySwift codebase. Please strictly adhere to these guidelines.

## Directory Structure
- `app/`: Next.js App Router. Contains API routes (`app/api/*`) and React pages.
- `components/`: UI Components using Tailwind and shadcn/ui.
- `lib/`: Core backend logic (database, Daraja API client, Auth, Crypto, Validation).
- `prisma/`: Prisma schema and migrations.
- `scripts/`: Utilities for migrations and database tasks.
- `tests/`: End-to-end tests (Playwright).

## Core Commands
- **Lint**: `npm run lint`
- **Test (Unit)**: `npm run test`
- **Test (E2E)**: `npx playwright test`
- **Dev Server**: `npm run dev`
- **Prisma Studio**: `npx prisma studio`

## Security Guardrails (CRITICAL)
1. **API Keys**: All API Keys are hashed (`sha256`) before being stored in the database. Never store plaintext keys.
2. **Secrets Encryption**: Webhook Secrets and Shopify Access Tokens must be encrypted at rest using AES-256-GCM.
   - Use `encryptSecret()` and `decryptSecret()` from `lib/crypto.ts`.
   - Never log secrets or API keys.
3. **Idempotency**: All payment endpoints (`/api/v1/payments/initiate`) must enforce cache-and-replay idempotency via `Idempotency-Key` header and Upstash Redis. Do not use destructive locks. Use `getCachedIdempotentResponse` and `cacheIdempotentResponse`.
4. **Daraja Asymmetric Trust**: NEVER rely on Daraja (`querySTKPushStatus`) for failure states. It can return false failures for pending/successful transactions. Only trust `ResultCode: 0` (success) for auto-healing. Non-success statuses must be treated as `pending` until a 30-minute expiration timeout.
5. **Rate Limiting**: Rate limits are centrally applied in `proxy.ts`. Do not bypass them.
6. **No Multi-tenancy Yet**: This is Phase 0. Multi-tenancy (Organizations, per-merchant Daraja credentials) is out of scope. Use centralized credentials.
7. **Logging**: Use `import { logger } from '@/lib/logger'` instead of `console.*` to ensure sensitive PII like phone numbers are masked.
8. **API Key Generation**: Never introduce a second, parallel API-key-generation code path outside `lib/api-keys.ts`. Every place that issues a new key (`app/api/merchant/api-keys/route.ts`, `app/api/merchant/setup/route.ts`, `app/api/demo/seed/route.ts`) must call `generateApiKey()` from that module.

## Security-Sensitive Files (extra care required)
Changes to any of these files should be treated as security-relevant and reviewed with extra scrutiny:
- `lib/daraja.ts` — Daraja credential resolution and API calls
- `lib/auth.ts` — API key authentication
- `lib/crypto.ts` — AES-256-GCM encryption/decryption of stored secrets
- `lib/api-keys.ts` — API key generation and hashing
- `lib/webhook.ts` — outbound webhook signing and delivery
- `lib/idempotency.ts` — payment idempotency cache
- `lib/rate-limit.ts` — rate limiting configuration
- `lib/transaction-finalization.ts` — webhook/Shopify finalization after a transaction concludes
- `app/api/mpesa/callback/route.ts` — the only writer of definitive transaction success/failure
- `app/api/cron/reconcile-transactions/route.ts` — reconciliation job; must preserve the asymmetric-trust rule in guardrail #4 above
