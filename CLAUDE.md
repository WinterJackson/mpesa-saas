# AI Agent Instructions for PaySwift

Welcome to the PaySwift repository! You are an AI Agent operating on the PaySwift codebase. Please strictly adhere to these guidelines.

## Directory Structure
- `app/`: Next.js App Router. Contains API routes (`app/api/*`) and React pages.
- `components/`: UI Components using Tailwind and shadcn/ui.
- `lib/`: Core backend logic (database, Daraja API client, Auth, Crypto, Validation).
- `lib/repositories/`: The only place tenant-scoped Prisma calls (`Organization`, `Membership`, `ApiKey`, `Transaction`, `OrganizationDarajaCredential`, `KycDocument`) are allowed to live.
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
6. **Multi-tenancy (Phase 1)**: `Organization` is the tenant root; every tenant-scoped Prisma call must go through `lib/repositories/*` and take `organizationId` as a required parameter — never query `Transaction`/`ApiKey`/`Merchant`/`OrganizationDarajaCredential` directly from a route or page. Daraja credentials are per-organization and encrypted (Model B — live credentials are always the organization's own, never pooled; sandbox is pooled/PaySwift-managed by default). Resolve "which org is the signed-in user acting in" via `getOrganizationContext()` (Clerk's active `orgId` first, sole `Membership` as fallback) — never via `Merchant.clerkUserId` alone.
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
- `lib/repositories/*` — the only place tenant-scoped Prisma calls may live; every function requires `organizationId`
- `lib/repositories/daraja-credentials.ts` — per-organization Daraja credential encryption/decryption (Model B)
- `lib/rbac.ts` — role enforcement (`owner`/`admin`/`developer`/`finance`); the source of truth is `Membership.role`, not Clerk's built-in org roles
- `lib/storage.ts` — R2 client for KYC documents; never generate a public (non-signed) URL for a stored document
- `app/api/webhooks/clerk/route.ts` — syncs Clerk Organization membership into the local `Membership` table; verifies Svix signatures via `verifyWebhook`
- `app/api/merchant/setup/route.ts` — the only place a Clerk Organization + local Organization/Membership(owner)/Merchant/API key are created together
- `lib/admin-auth.ts` — platform-admin gating (`AdminUser` table), deliberately separate from `lib/rbac.ts`
- `app/api/admin/*` — platform admin console routes; every mutation must write an `AuditLog` row
- `lib/daraja-security-credential.ts` — RSA-encrypts the initiator password with Safaricom's public cert to build the B2C/Reversal/Balance `SecurityCredential`; the cert is a public key but treated as security-sensitive
- `lib/daraja-b2c.ts`, `lib/daraja-c2b.ts`, `lib/daraja-reversal.ts`, `lib/daraja-account-balance.ts`, `lib/daraja-transaction-status.ts`, `lib/daraja-initiator.ts` — per-organization Daraja money-movement/query calls; all resolve credentials per-org (Model B), never a global constant
- `lib/payouts.ts`, `lib/payout-finalization.ts` — B2C payout/refund orchestration + webhook finalization
- `app/api/mpesa/b2c/result/route.ts` — the only writer of definitive payout/refund success/failure (as the STK callback is for transactions); its non-zero result IS authoritative (unlike `querySTKPushStatus`)
- `app/api/mpesa/c2b/{validation,confirmation}/route.ts` — C2B attribution by shortcode; confirmation is idempotent on the M-Pesa receipt
- `app/api/mpesa/{transaction-status,account-balance,reversal}/result/route.ts` — initiator-command result callbacks; correlate via the `DarajaCommand` ledger
- `app/api/admin/organizations/[id]/go-live/route.ts` — superadmin go-live approval; validates live credentials against Safaricom before flipping to live
- `app/api/cron/reconcile-ledger/route.ts` — nightly ledger reconciliation; must preserve guardrail #4 (surface mismatches, never auto-fail)
- `lib/cron-auth.ts` — the ONLY authorizer for cron endpoints (`isAuthorizedCronRequest`); fails closed when `CRON_SECRET` is unset. Every `app/api/cron/*` route must gate on it. Cron jobs run via an external scheduler (cron-job.org), not Vercel Cron.

## Phase 2 guardrails (payments engine)
9. **B2C SecurityCredential**: never store or log the raw initiator password in plaintext — it is AES-encrypted at rest (`initiatorPassword*Encrypted`) and RSA-encrypted per call via `lib/daraja-security-credential.ts`. Never introduce a second SecurityCredential path.
10. **Payout/refund terminal status** is written ONLY by the B2C result callback (`app/api/mpesa/b2c/result`), correlated by `originatorConversationId` — mirror the STK callback's sole-writer authority. The B2C QueueTimeout is NOT a definitive failure; leave the record pending for reconciliation.
11. **Go-live is admin-gated**: a merchant reaches live mode only after `Organization.liveApprovedAt` is set by a superadmin (who first validates live credentials against Safaricom). Do not reintroduce a credential-presence-only self-flip.
12. **Reconciliation surfaces, never mutates**: the nightly ledger job records `ReconciliationMismatch` rows for human review; it must never flip a record to failed (guardrail #4).
