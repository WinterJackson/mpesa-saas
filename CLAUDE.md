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
4. **Rate Limiting**: Rate limits are centrally applied in `proxy.ts`. Do not bypass them.
5. **No Multi-tenancy Yet**: This is Phase 0. Multi-tenancy (Organizations, per-merchant Daraja credentials) is out of scope. Use centralized credentials.
6. **Logging**: Use `import { logger } from '@/lib/logger'` instead of `console.*` to ensure sensitive PII like phone numbers are masked.
