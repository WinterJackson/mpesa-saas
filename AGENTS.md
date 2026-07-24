# PaySwift - Agent Onboarding & Environment Guide

This document outlines the required environment setup and architectural constraints for AI agents and human developers alike.

## Required Environment Variables
To operate the backend locally, you must provide the following variables in `.env.local`:

```ini
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/payswift"
# Optional — restricted role (no BYPASSRLS) the running app connects as so
# Postgres Row-Level Security actually enforces. See "Row-Level Security" under
# Operational Runbooks below. Falls back to DATABASE_URL when unset.
# DATABASE_APP_URL="postgresql://app_runtime:pass@localhost:5432/payswift"

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
# Optional — only set during a key-rotation window, see "Encryption key
# rotation" under Operational Runbooks below.
# ENCRYPTION_KEY_PREVIOUS="..."

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

# Optional — durable webhook delivery via Inngest (Phase 4, Stage 5). Scoped to
# webhook delivery only; the 3 app/api/cron/* jobs stay on cron-job.org. Until
# set, webhook delivery falls back to the direct in-request path (unchanged).
# INNGEST_EVENT_KEY="..."
# INNGEST_SIGNING_KEY="..."

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
12. **Scale, observability & compliance (Phase 4)**:
    - **Row-Level Security** on `WebhookDelivery`/`Refund` is defense-in-depth BEHIND the `lib/repositories/*` scoping, queried only via `withTenantContext`/`withPlatformContext` (`lib/db.ts`). It only enforces because the app connects as the restricted `app_runtime` role (`DATABASE_APP_URL`) — Neon's owner role has BYPASSRLS. See the Row-Level Security runbook below before enabling RLS on a new table.
    - **Encryption keys are rotatable** (`lib/crypto.ts`, fingerprint-tagged ciphertext + optional `ENCRYPTION_KEY_PREVIOUS`) — see the runbook below. Never add a second encryption path.
    - **Durable webhook delivery** goes through `dispatchWebhook` (`lib/webhook-dispatch.ts`): Inngest when configured (webhook-delivery ONLY — the 3 `app/api/cron/*` jobs stay on cron-job.org), direct fallback otherwise.
    - **Observability** — `lib/tracing.ts`'s `withApiSpan` wraps Daraja calls + webhook dispatch in Sentry spans tagged with `organizationId` only.
    - **Read replica** — `prismaReadonly` (`lib/db-readonly.ts`) for read-heavy admin/reporting only; never the payment-write path. Provision a real replica only when it's measurably needed (`DATABASE_REPLICA_URL`).
    - **Status page** — `/status` backed by `app/api/cron/health-check` (add it to the cron-job.org schedule).
    - **Compliance** — `data-export` (never includes secrets) and `data-deletion-request` (admin-reviewed, never auto-deleted). Sanctions screening is a deliberate deferred gap; CBK PSP authorization and ODPC registration are legal/organizational action items, not code.

## Operational Runbooks

### Encryption key rotation
`lib/crypto.ts`'s `encryptSecret`/`decryptSecret` support rotating `ENCRYPTION_KEY` without breaking
decryption of already-encrypted rows (Shopify tokens, per-organization Daraja credentials, webhook
secrets). Each ciphertext is tagged with a short fingerprint of the key it was written under, so
decryption can pick the right key out of at most two candidates.

To rotate:
1. Generate a new 32-byte base64 key (e.g. `openssl rand -base64 32`).
2. Set `ENCRYPTION_KEY_PREVIOUS` to the **current** `ENCRYPTION_KEY` value.
3. Set `ENCRYPTION_KEY` to the **new** value. Deploy.
4. New writes are encrypted under the new key immediately. Existing rows keep decrypting correctly via
   `ENCRYPTION_KEY_PREVIOUS` until they're next re-encrypted (e.g. their next update) or backfilled by a
   one-off re-encryption script.
5. Once no row still depends on the old key, remove `ENCRYPTION_KEY_PREVIOUS`.

Ciphertext written before this rotation-support existed (no fingerprint prefix) keeps decrypting under
whatever `ENCRYPTION_KEY` is current, exactly as before — no migration needed for those rows.

### Row-Level Security (RLS)
Some tenant-scoped tables (currently `WebhookDelivery`, `Refund` — see `prisma/migrations/20260724000000_enable_rls_webhookdelivery_refund`)
have Postgres RLS enabled as defense-in-depth **behind** the existing `lib/repositories/*` application-level
scoping, not a replacement for it. Every affected repository function routes through `withTenantContext`/
`withPlatformContext` (`lib/db.ts`).

**Critical gotcha, confirmed by direct testing:** Neon's default `neondb_owner` role has the `BYPASSRLS`
attribute, which makes RLS policies a complete no-op for any connection using that role — `FORCE ROW LEVEL
SECURITY` does not override `BYPASSRLS`. The app must connect as a separate, restricted role for RLS to mean
anything. `scripts/create-app-runtime-role.ts` provisions this role (`app_runtime`, no BYPASSRLS/SUPERUSER/
CREATEDB/CREATEROLE, granted DML on all current + future tables). Its connection string goes in
`DATABASE_APP_URL` — `DATABASE_URL` (owner role) stays in use for migrations only, since the restricted role
has no DDL privileges.

To extend RLS to another table:
1. Audit every call site of that Prisma model (not just its own repository file — grep the whole `app/`
   and `lib/` trees) and confirm every one already routes through `lib/repositories/*`. If any don't,
   fix that first — enabling `FORCE ROW LEVEL SECURITY` before every call site is updated will silently
   break those call sites (they'll see zero rows / get insert failures).
2. Convert the repository functions to route through `withTenantContext` (org-scoped) or
   `withPlatformContext` (documented cross-org lookups only).
3. Write the migration (`ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY`, see the migration above
   for the exact pattern).
4. Run `npx tsx scripts/verify-rls.ts` (or an equivalent check for the new table) against
   `DATABASE_APP_URL` — NOT `DATABASE_URL` — before considering it done. Testing against the owner role
   will pass trivially and prove nothing.

To rotate `app_runtime`'s password: re-run `npx tsx scripts/create-app-runtime-role.ts` (idempotent — it
rotates the password on every run) and update `DATABASE_APP_URL` everywhere it's set.

### Read replica (deferred provisioning)
`lib/db-readonly.ts`'s `prismaReadonly` client already routes the admin organizations list, billing/MRR
listing, and reconciliation-mismatch listing (the read-heavy, non-transactional admin/reporting queries)
away from the primary client — but falls back to the exact same primary client when `DATABASE_REPLICA_URL`
is unset, which it is today. **Do not provision an actual Neon read replica branch preemptively.** Do it
only when admin/reporting queries measurably contend with the transactional payment-write path (e.g. slow
admin dashboard loads correlating with payment-processing latency in Sentry). At that point: create a Neon
read replica branch, set `DATABASE_REPLICA_URL` to its connection string, done — no code change needed.

### Status page health checks
`app/api/cron/health-check` (new in Phase 4, Stage 7) needs adding to the same cron-job.org schedule as the
other 3 `app/api/cron/*` jobs — every few minutes is enough, this isn't a sub-minute uptime monitor. It
backs the public `/status` page (`lib/repositories/health-checks.ts`). A component whose prerequisite env
vars aren't configured (e.g. no Upstash Redis) is simply omitted from both the check and the page, never
reported with a misleading status.
