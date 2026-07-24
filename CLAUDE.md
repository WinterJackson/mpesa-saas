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
- `lib/repositories/payment-links.ts` — org-scoped Payment Link CRUD; `findActiveLinkBySlug()` / `findLinkTransactionStatus()` are the ONLY deliberately un-scoped lookups (the public `/pay/[slug]` hosted checkout — the slug is the capability, documented like the C2B shortcode lookup). A `live` link must be refused until the org's `liveApprovedAt` is set.
- `app/api/pay/[slug]/*` — public, unauthenticated hosted-checkout endpoints (no API key; IP-rate-limited via `proxy.ts`). Fixed links ignore any client amount; live links gated on go-live.
- `lib/shopify.ts` — now also holds the one-click OAuth app-install helpers (`verifyOAuthHmac`, `exchangeCodeForToken`, `registerOrdersWebhook`); `SHOPIFY_CLIENT_SECRET` both completes the OAuth exchange and verifies inbound webhooks. Never log the access token; it is AES-encrypted at rest.
- `app/api/integrations/shopify/oauth/{start,callback}/route.ts` — the OAuth install flow; the callback verifies the request HMAC + a CSRF `state` cookie before exchanging the code and must never store a token otherwise.
- `lib/schemas/*` — the single Zod validation entry point for every `/api/v1/*` and public `/api/pay/*` request; reuse `validatePhone`/`validateAmount` as normalizers, never add a parallel validation path.
- `lib/openapi.ts` — the frozen `/api/v1` contract as OpenAPI 3.1 (served at `/api/v1/openapi.json`, rendered at `/docs`). Breaking changes go to `/api/v2`; never mutate v1 in place.
- `lib/webhook-events.ts` — canonical webhook event catalog; every emit site uses it. Adding an event means adding it here first.
- `lib/repositories/webhook-deliveries.ts` — the ONLY writer of `WebhookDelivery` (via `recordDelivery`, which sets `event`/`organizationId`/`status`); `listDeliveries` is org-scoped and spans transaction/payout/refund. Do not reintroduce inline `prisma.webhookDelivery.create` calls.
- `lib/plan-rate-limit.ts` — per-org, per-plan API rate limiting enforced in-route post-auth; fails OPEN when Redis is down so a limiter outage can never block money movement. The coarse `proxy.ts` limiter stays the first line.
- `lib/view-env.ts` + `lib/actions/view-env.ts` — the dashboard Sandbox/Live VIEW filter (a per-user cookie), strictly a list-view filter; it must NEVER change a merchant's operational environment (that is the admin-gated `EnvironmentCard`).
- `lib/db.ts` — besides the primary Prisma client, exports `withTenantContext`/`withPlatformContext`, the ONLY way to run a query against an RLS-enabled table (`WebhookDelivery`, `Refund`). The app connects via `DATABASE_APP_URL` (a restricted role without BYPASSRLS) so RLS actually enforces; `DATABASE_URL` (owner) is migrations-only. See AGENTS.md's Row-Level Security runbook before enabling RLS on a new table.
- `lib/db-readonly.ts` — `prismaReadonly`, an optionally replica-backed (`DATABASE_REPLICA_URL`) read client for read-heavy admin/reporting queries ONLY. Never route a payment-write or any tenant-scoped `lib/repositories/*` function through it.
- `lib/crypto.ts` — AES-256-GCM with key-rotation support: ciphertext is fingerprint-tagged so `decryptSecret` can read rows under `ENCRYPTION_KEY` or `ENCRYPTION_KEY_PREVIOUS`. Legacy untagged ciphertext still decrypts under the current key. Never introduce a second encryption path.
- `scripts/create-app-runtime-role.ts` — provisions the restricted `app_runtime` Postgres role (no BYPASSRLS) that makes RLS enforce; `scripts/verify-rls.ts` proves cross-tenant isolation against `DATABASE_APP_URL`. Run the latter after enabling RLS on any new table.
- `lib/inngest.ts`, `lib/inngest-functions.ts`, `lib/webhook-dispatch.ts`, `app/api/inngest/route.ts` — durable webhook delivery via Inngest (webhook-delivery ONLY; cron stays on cron-job.org). `dispatchWebhook` is the single entry point: Inngest when configured, direct `deliverWebhook`+`recordDelivery` fallback otherwise. Dormant until `INNGEST_EVENT_KEY` is set.
- `lib/tracing.ts` — `withApiSpan` wraps outbound Daraja calls and webhook dispatch in Sentry spans tagged with `organizationId` ONLY, never PII/secrets.
- `lib/url-safety.ts` — SSRF blocklist for merchant-supplied webhook URLs (localhost/RFC1918/loopback/169.254 metadata). Defense-in-depth behind `lib/webhook.ts`'s `redirect: 'manual'` (the DNS-rebinding-proof primary guard) — keep both.
- `app/api/merchant/data-export/route.ts` — Kenya DPA right-of-access: returns the org's OWN data as JSON (owner/admin). NEVER include secret material (key hashes, encrypted credentials, webhook secrets).
- `app/api/merchant/data-deletion-request/route.ts` + `lib/repositories/data-deletion-requests.ts` — right-to-erasure: records an admin-reviewed request (owner only). Deletion is NEVER auto-executed — financial retention (AML/POCAMLA) conflicts with blanket erasure.
- `app/api/cron/health-check/route.ts` + `lib/repositories/health-checks.ts` — periodic self-checks backing the public `/status` page; gated by `isAuthorizedCronRequest`, runs on cron-job.org. A component with unconfigured prerequisites is omitted, never reported with a misleading status.
- `scripts/restore-drill.md`, `scripts/incident-response.md` — the DR restore runbook (Neon PITR, RTO/RPO) and the incident/breach-notification runbook (Sev scale, Kenya DPA 72-hour obligation). Process docs, not code — keep current as the topology changes.
- `lib/email/*` — transactional email via Resend, for BUSINESS-workflow notifications ONLY. `client.ts` is the single Resend entry point (fails OPEN when `RESEND_API_KEY` is unset, never throws, PII-masked logs); `notifications.ts` is the ONLY thing routes/finalizers call (`notify*`); `templates.ts` is the canonical catalog (add a builder here first); `recipients.ts` resolves merchant emails from Clerk and staff emails from `AdminUser.email`. NEVER put a secret (API key, webhook secret, credential) in an email body — only non-secret prefixes. Clerk still owns EVERY identity/auth email (password reset, verification, sign-in, org/team invitations) — do not duplicate or reroute those through Resend.

## Phase 2 guardrails (payments engine)
9. **B2C SecurityCredential**: never store or log the raw initiator password in plaintext — it is AES-encrypted at rest (`initiatorPassword*Encrypted`) and RSA-encrypted per call via `lib/daraja-security-credential.ts`. Never introduce a second SecurityCredential path.
10. **Payout/refund terminal status** is written ONLY by the B2C result callback (`app/api/mpesa/b2c/result`), correlated by `originatorConversationId` — mirror the STK callback's sole-writer authority. The B2C QueueTimeout is NOT a definitive failure; leave the record pending for reconciliation.
11. **Go-live is admin-gated**: a merchant reaches live mode only after `Organization.liveApprovedAt` is set by a superadmin (who first validates live credentials against Safaricom). Do not reintroduce a credential-presence-only self-flip.
12. **Reconciliation surfaces, never mutates**: the nightly ledger job records `ReconciliationMismatch` rows for human review; it must never flip a record to failed (guardrail #4).

## Phase 3 guardrails (merchant integration & developer experience)
13. **Payment Links are org-scoped** except the two documented public lookups (`findActiveLinkBySlug`, `findLinkTransactionStatus`) that power `/pay/[slug]`. A `live` link must not transact until the org is go-live approved (reuse the existing gate — never a self-flip).
14. **`/api/v1` is frozen.** Backwards-incompatible changes ship under `/api/v2`; only additive/optional changes touch v1. Keep `lib/openapi.ts` and the Zod schemas in `lib/schemas/*` in sync with the routes — the docs are generated from the schemas so they can't silently drift.
15. **Webhook deliveries** are written only through `recordDelivery` (event + org + status), and `payout.reversed` is fired by the Reversal result callback like the other terminal events. Redelivery re-sends the stored payload to the merchant's CURRENT URL/secret.
16. **Shopify OAuth**: the callback must verify BOTH the request HMAC (`SHOPIFY_CLIENT_SECRET`) and the CSRF `state` cookie before exchanging the code; the flow stays dormant until `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` are set. The native Payment App is deferred to Phase 5.
17. **The dashboard Sandbox/Live toggle is a view filter only** — never let it change payment routing (`Merchant.environment`), which remains admin-gated.

## Phase 4 guardrails (scale, observability & compliance)
18. **Row-Level Security is defense-in-depth, not a replacement** for the `lib/repositories/*` application-level `organizationId` scoping — every repository function still takes and filters by `organizationId`. RLS-enabled tables (`WebhookDelivery`, `Refund`) are queried ONLY through `withTenantContext`/`withPlatformContext` (`lib/db.ts`). RLS only enforces because the app connects as the restricted `app_runtime` role (`DATABASE_APP_URL`) — Neon's owner role has BYPASSRLS. Before enabling RLS on another table, audit that EVERY call site already routes through `lib/repositories/*`, then verify with `scripts/verify-rls.ts` against `DATABASE_APP_URL` (see AGENTS.md).
19. **Encryption keys are rotatable**: ciphertext is fingerprint-tagged (`lib/crypto.ts`) so `ENCRYPTION_KEY` can rotate with `ENCRYPTION_KEY_PREVIOUS` bridging existing rows. Never store or log plaintext secrets; never add a second encryption path.
20. **Inngest is webhook-delivery-only**; the three `app/api/cron/*` jobs stay on cron-job.org. Always deliver webhooks through `dispatchWebhook` (`lib/webhook-dispatch.ts`), which stays correct whether or not Inngest is configured.
21. **Data-deletion requests are never auto-executed** — they are recorded for admin review because financial record-retention (AML/POCAMLA) conflicts with blanket erasure. `data-export` must never include secret material.
22. **Sanctions/AML screening at onboarding is a known, deliberate gap** — manual KYC review only for now (documented in the master plan). Revisit with a screening vendor when real transaction volume or a specific merchant risk signal justifies it, not speculatively. The CBK PSP authorization question and ODPC registration are legal/organizational action items, not code.
23. **Transactional email (Resend) is business-workflow only and fails OPEN.** Send exclusively through `notify*` in `lib/email/notifications.ts`; those resolve recipients + render a `lib/email/templates.ts` builder and can NEVER throw or block a request (they short-circuit when `RESEND_API_KEY` is unset). Dispatch from routes/finalizers via Next's `after()` so email is post-response fire-and-forget — never inline in the money-movement path. Clerk owns all identity/auth email; Resend must never send password/verification/sign-in/team-invite mail. No secret material ever goes in an email body.
