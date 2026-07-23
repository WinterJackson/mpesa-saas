# PaySwift - Agent Onboarding & Environment Guide

This document outlines the required environment setup and architectural constraints for AI agents and human developers alike.

## Required Environment Variables
To operate the backend locally, you must provide the following variables in `.env.local`:

```ini
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/payswift"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Cryptography (Foundation Hardening)
# 32-byte base64 encoded AES-256-GCM key
ENCRYPTION_KEY="..."

# M-Pesa Daraja Central Credentials
MPESA_CONSUMER_KEY="..."
MPESA_CONSUMER_SECRET="..."
MPESA_PASSKEY="..."
MPESA_SHORTCODE="174379"
MPESA_CALLBACK_URL="https://your-ngrok-domain.ngrok-free.app/api/mpesa/callback"
MPESA_ENVIRONMENT="sandbox"

# Upstash Redis (Rate Limiting & Idempotency)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Cron Jobs
CRON_SECRET="..."

# Observability
NEXT_PUBLIC_SENTRY_DSN="..."

# Optional — KYC document storage (Cloudflare R2). lib/storage.ts throws a
# clear error only when a KYC upload is attempted without these set.
# R2_ACCOUNT_ID="..."
# R2_ACCESS_KEY_ID="..."
# R2_SECRET_ACCESS_KEY="..."
# R2_BUCKET_NAME="..."

# Optional — required once a webhook endpoint is added in the Clerk Dashboard
# pointing at /api/webhooks/clerk (organization membership sync).
# CLERK_WEBHOOK_SIGNING_SECRET="..."

# Optional (Phase 2) — Safaricom public certificates for the B2C/Reversal/Balance
# SecurityCredential. Public keys; git-ignored under certs/. Default paths are
# certs/sandbox.cer and certs/production.cer.
# MPESA_SANDBOX_CERT_PATH="./certs/sandbox.cer"
# MPESA_PRODUCTION_CERT_PATH="./certs/production.cer"
# Optional — platform base URL for Daraja Result/Timeout callbacks (B2C/C2B/etc.
# point at OUR routes). Falls back to MPESA_CALLBACK_URL's origin. Set this to a
# fixed-IP proxy origin if Safaricom requires a static outbound IP for production.
# MPESA_CALLBACK_BASE_URL="https://your-app.example.com"
```

## Setup Steps
1. Clone the repository.
2. Run `npm install`.
3. Create `.env.local` and populate it with every variable listed above.
4. Run `npx prisma generate && npx prisma db push`.
5. Run `npm run dev`.

## Commit Conventions
Use Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `security:`) for every commit — this is already the de facto pattern in this repo's history.

## Architectural Constraints
1. **App Router**: We strictly use the Next.js App Router (`app/` directory). Do not introduce `pages/`.
2. **Serverless Execution**: All API Routes run in a serverless environment (Vercel). Avoid long-running background tasks.
   - For fire-and-forget tasks (like delivering webhooks), use Next.js `after()`.
3. **Database Client**: Always use the `PrismaNeon` adapter to support Vercel Edge connections. See `lib/db.ts`.
4. **Type Safety**: Avoid using `any`. Use `unknown` with narrow type assertions if absolutely necessary.
5. **No Breaking Migrations**: Do not break the database schema for the existing demo user. Write backfill scripts for zero-downtime migrations.
6. **API Key Schema**: API Keys are strictly stored as `keyHash` and `keyPrefix`. There is no plaintext `key` column. Do not attempt to query or read plaintext keys from the database.
7. **Migrations**: Never hand-edit a migration file under `prisma/migrations/` that has already been applied. Create a new migration instead — this exact mistake caused a real data-loss incident during Phase 0 and must not be repeated.
8. **Secrets**: Never commit `.env` or `.env.local`. Never touch live Daraja, Clerk, Sentry, Upstash, or billing-provider credentials under any circumstance.
9. **Tenant Scoping (Phase 1)**: `lib/repositories/*` is the only place tenant-scoped Prisma calls (`Organization`, `Membership`, `ApiKey`, `Transaction`, `OrganizationDarajaCredential`, `KycDocument`, `Payout`, `Refund`) are allowed to live. Every function in it takes `organizationId` as a required parameter — except the deliberately un-scoped callback-correlation lookups (`findPayoutByOriginatorId`, `findOrgContextByShortcode`, `findDarajaCommandByOriginatorId`) and platform-level admin/reconciliation queries, which are documented as such.
10. **Payments engine (Phase 2)**: the full Daraja suite (STK, C2B, B2C payouts/refunds, Transaction Status, Account Balance, Reversal) resolves credentials per-organization (Model B). Terminal payout/refund status is written ONLY by the B2C result callback. Going live is admin-gated (`Organization.liveApprovedAt`). Reconciliation surfaces mismatches, never auto-fails (guardrail #4). B2C initiator passwords are AES-encrypted at rest and RSA-encrypted per call — never plaintext.
11. **Merchant integration & DX (Phase 3)**:
    - **Payment Links** are org-scoped (`lib/repositories/payment-links.ts`); the public hosted checkout `/pay/[slug]` and its `/api/pay/*` endpoints use the two documented un-scoped slug lookups (the slug is the capability) and are IP-rate-limited. A `live` link is gated on the org's go-live approval.
    - **`/api/v1` is a FROZEN contract** — breaking changes go to `/api/v2`. Every v1/`/api/pay` request validates through a single Zod schema in `lib/schemas/*`; the OpenAPI 3.1 doc (`lib/openapi.ts`, served at `/api/v1/openapi.json`, rendered at `/docs`) is generated from those schemas.
    - **Webhooks**: write deliveries only through `recordDelivery` (`lib/repositories/webhook-deliveries.ts`), which sets `event`/`organizationId`/`status`; event names live in `lib/webhook-events.ts`. `payout.reversed` is fired by the Reversal result callback.
    - **Per-plan rate limits** (`lib/plan-rate-limit.ts`) are enforced in-route post-auth and fail OPEN when Redis is down — never let the limiter block money movement.
    - **Shopify** uses a one-click OAuth app install; the callback verifies HMAC + a CSRF state cookie before storing an (encrypted) token. Dormant until `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` are set.
    - The dashboard **Sandbox/Live toggle is a view filter only** (`lib/view-env.ts`) — it must never change `Merchant.environment`.
