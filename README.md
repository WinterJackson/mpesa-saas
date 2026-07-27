# PaySwift — M-Pesa SaaS Platform

PaySwift is a production-ready, multi-tenant M-Pesa payments platform that lets any business collect, pay out, and reconcile M-Pesa transactions — with no-code tools for non-technical merchants and a full REST API + SDK for developers. Built on Next.js 16, Prisma, PostgreSQL, and Clerk, it covers the whole lifecycle: onboarding and KYC, the full Daraja API surface (STK Push, C2B, B2C, refunds, reversals), role-based team access, subscription billing for the platform itself, and an admin console with cross-tenant analytics.

## Table of Contents
- [Core Features](#-core-features)
- [Quick Start & Setup](#-quick-start--setup)
- [Reviewer / Test Access](#-reviewer--test-access)
- [Testing Guide](#-testing-guide)
- [Developer Integration](#-developer-integration)
- [Shopify Integration Guide](#️-shopify-integration-guide)
- [Operations & Maintenance](#-operations--maintenance)
- [Known Limitations](#️-known-limitations)

---

## ✨ Core Features

### Payment Collection
- **STK Push** (`POST /api/v1/payments/initiate`) — the standard customer-initiated "enter your PIN" prompt.
- **No-code Payment Links** — create a link in the dashboard (fixed or customer-set amount), share it, show its QR code, or paste the embeddable "Pay with M-Pesa" button on any site. Customers pay on a PaySwift-hosted checkout at `/pay/[slug]` — no integration work required.
- **C2B** (`POST /api/v1/c2b/register-urls`, callbacks at `/api/mpesa/c2b/*`) — for customers who dial your Paybill directly instead of using STK Push; confirmation is idempotent on receipt.

### Payouts & Refunds
- **B2C payouts** (`POST /api/v1/payouts`) — send money out to a phone number; results land at `/api/mpesa/b2c/result`, the sole writer of terminal payout status.
- **Bulk payouts** — upload multiple payouts at once from the dashboard (Payouts → Bulk Upload); each row is validated and queued individually, processed asynchronously via Inngest, and every row still passes through the same per-organization approval threshold as a single payout (see below).
- **Dual-approval workflow** — payouts at or above an organization's configurable threshold (KES 10,000 by default) are held in a `pending` state and require a second Owner/Admin/Finance teammate — never the original initiator — to approve before Safaricom is contacted. Rejections are recorded with a reason and never reach Daraja.
- **Refunds** (`POST /api/v1/refunds`) — B2C money back to a customer for a completed transaction.
- **Reversals** (`POST /api/admin/payouts/[id]/reverse`, superadmin-only) — undo a wrongly-sent payout.

### Developer Experience
- **`payswift-node` SDK** — typed client with automatic retries and idempotency-key generation. See [Developer Integration](#-developer-integration).
- **Frozen REST API** at `/api/v1`, documented with an **OpenAPI 3.1** spec (`/api/v1/openapi.json`) and an interactive reference at **`/docs`**.
- **Cursor pagination** on list endpoints (`{ data, nextCursor }`) and **per-plan rate limits** (`X-RateLimit-*` headers, `429` + `Retry-After`).
- **Webhooks** — a canonical event catalog (including `payout.reversed`), HMAC-SHA256 signing, a **delivery inspector** at `/settings/webhooks` with a payload viewer and one-click redelivery, and a signed test-event button. See `/docs/webhooks`.
- **Idempotency-Key** support on every mutating endpoint (Redis fast path + durable Postgres fallback).
- **Sandbox/Live view filter** in the dashboard — a list-view filter, distinct from the admin-gated payment-routing switch that actually flips an organization from sandbox to live credentials.

### Platform Billing & Analytics
- **Subscription billing** for merchants themselves (Starter/Growth/Scale/Enterprise plans), automated STK-based collection, dunning on failed charges, and **PDF billing statements** on demand (`/dashboard/billing` → Statement, or `GET /api/merchant/billing/statement/pdf`).
- **Merchant-facing analytics** — revenue trend, payment-source mix, conversion funnel, and a friendly breakdown of failure reasons, on the dashboard Overview.
- **Admin analytics** (`/admin`, `/admin/billing`) — MRR and month-over-month growth, churn rate, signup-to-revenue funnel, plan-tier revenue distribution, at-risk (past-due) accounts, cohort retention by signup month, ARPM (average revenue per paying merchant), and an approximated dunning-recovery rate. Real-time dashboard updates via server-sent events — no manual refresh needed.
- **Admin operational tools** — cross-tenant transaction search, shortcode balance monitoring with low-balance alerting, and a full audit log of sensitive admin actions.

### Integrations
- **One-click Shopify** — connect a store from Settings → Integrations via OAuth; new orders automatically trigger an M-Pesa prompt and paid orders are marked paid in Shopify. See the [Shopify Integration Guide](#️-shopify-integration-guide) below.

### Security & Compliance
- **Role-based access control (RBAC)** on two separate levels:
  - **Merchant team roles** (per organization): `owner`, `admin`, `developer`, `finance` — gating team management, billing, API keys, and payout approval respectively. Invite teammates from Settings → Team.
  - **Platform admin roles**: `support`, `kyc_reviewer`, `finance`, `ops`, `superadmin` — each scoped to a specific capability set (e.g. `kyc_reviewer` can review KYC submissions but not touch billing; only `superadmin` can reverse a payout).
- **Database-level tenant isolation** — Postgres Row-Level Security on `WebhookDelivery`/`Refund` as defense-in-depth behind the application's own `organizationId` scoping. The app connects as a restricted `app_runtime` role (`DATABASE_APP_URL`) so RLS actually enforces; `DATABASE_URL` (the owner role) is migrations-only.
- **Rotatable AES-256-GCM encryption** for stored Daraja credentials — `ENCRYPTION_KEY` can rotate with `ENCRYPTION_KEY_PREVIOUS` bridging existing rows, no downtime or backfill required.
- **Durable webhook delivery** via Inngest (optional — falls back to direct delivery until `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` are set).
- **Tracing** — Sentry spans around every outbound Daraja call and webhook dispatch, tagged per-organization, never with PII.
- **Public status page** at `/status`, backed by a self-check of DB, Redis, and Daraja sandbox reachability.
- **Compliance groundwork (Kenya DPA)** — self-service data export and an admin-reviewed data-deletion request flow (deletion is never auto-executed). Runbooks live at `scripts/restore-drill.md` (Neon PITR disaster recovery) and `scripts/incident-response.md` (severity scale + breach notification); reliability/SLA docs at `/docs/reliability`.
- **CI hardening** — gitleaks secret scanning and `npm audit` (critical-severity gate), alongside CodeQL and Dependabot.
- **Transactional email (Resend)** — branded notifications across onboarding, KYC, go-live, payouts/refunds, invoices, and security events (API key created, webhook secret rotated). Optional and fail-open: dormant until `RESEND_API_KEY`/`EMAIL_FROM` are set, and email can never block a request or money movement. Clerk still owns all identity/auth email (password, verification, sign-in, invites) — Resend never touches those.

---

## 🚀 Quick Start & Setup

### Prerequisites
- Node.js v18+
- A PostgreSQL database (e.g., Neon)
- Clerk API keys (for authentication)

### 1. Clone & Install
```bash
git clone https://github.com/WinterJackson/mpesa-saas.git
cd mpesa-saas
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the project root. This list is cross-checked against `AGENTS.md` — if you spot the two ever disagree again, `AGENTS.md` is the one meant to be exhaustive; open an issue rather than guessing which is stale.

```env
# Database
DATABASE_URL="postgres://user:password@host/db"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# M-Pesa Daraja Credentials (Sandbox)
MPESA_CONSUMER_KEY="your_safaricom_consumer_key"
MPESA_CONSUMER_SECRET="your_safaricom_consumer_secret"
MPESA_PASSKEY="your_safaricom_passkey"
MPESA_SHORTCODE="174379"
MPESA_CALLBACK_URL="https://your-ngrok-domain.ngrok-free.app/api/mpesa/callback"
MPESA_ENVIRONMENT="sandbox"

# REQUIRED Infrastructure Variables (system will fail to start without these)
ENCRYPTION_KEY="..." # 32-byte base64 AES-256-GCM key — generate with: openssl rand -base64 32
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
CRON_SECRET="..."
NEXT_PUBLIC_SENTRY_DSN="https://..."

# Only required if you complete Safaricom's Go-Live KYC process and want to enable Live mode
# MPESA_CONSUMER_KEY_LIVE=""
# MPESA_CONSUMER_SECRET_LIVE=""
# MPESA_PASSKEY_LIVE=""
# MPESA_SHORTCODE_LIVE=""
# MPESA_CALLBACK_URL_LIVE=""

# Optional — KYC document storage (Cloudflare R2, S3-compatible). The onboarding
# wizard's KYC upload step returns a 503 with a clear message until these are set.
# R2_ACCOUNT_ID=""
# R2_ACCESS_KEY_ID=""
# R2_SECRET_ACCESS_KEY=""
# R2_BUCKET_NAME=""

# Optional — required once you add a webhook endpoint in the Clerk Dashboard
# pointing at /api/webhooks/clerk (organization membership sync).
# CLERK_WEBHOOK_SIGNING_SECRET=""

# Optional — Safaricom public certs for the B2C/Reversal/Balance SecurityCredential
# (public keys, git-ignored under certs/). Default paths are certs/sandbox.cer and
# certs/production.cer.
# MPESA_SANDBOX_CERT_PATH="./certs/sandbox.cer"
# MPESA_PRODUCTION_CERT_PATH="./certs/production.cer"
# Optional — base URL for Daraja Result/Timeout callbacks (they hit OUR routes).
# Falls back to MPESA_CALLBACK_URL's origin. Point at a fixed-IP proxy if
# Safaricom requires a static outbound IP for production go-live.
# MPESA_CALLBACK_BASE_URL=""

# Webhook Domain (use ngrok for local testing)
NEXT_PUBLIC_APP_URL="https://your-ngrok-domain.ngrok-free.app"

# Optional — public base URL used to build the Shopify OAuth redirect and
# auto-registered webhook address. Falls back to the request origin.
# APP_BASE_URL=""

# Optional (Billing) — PaySwift's OWN M-Pesa collector for subscription billing
# (distinct from any merchant's own shortcode). Until set, subscription billing
# falls back to the pooled sandbox credentials (MPESA_* above) so the STK billing
# + dunning flow is fully demonstrable in sandbox.
# PLATFORM_BILLING_CONSUMER_KEY=""
# PLATFORM_BILLING_CONSUMER_SECRET=""
# PLATFORM_BILLING_SHORTCODE=""
# PLATFORM_BILLING_PASSKEY=""
# PLATFORM_BILLING_CALLBACK_URL=""
# PLATFORM_BILLING_ENV="sandbox" # sandbox | live (defaults to live when a Paybill is set)

# Optional (Billing/Tax) — PaySwift's own KRA tax identity for the invoices it
# issues. Until PLATFORM_VAT_REGISTERED="true", invoices are interim non-tax
# documents (VAT 0, no eTIMS/CU number).
# PLATFORM_KRA_PIN=""
# PLATFORM_VAT_REGISTERED="false"

# Optional — one-click Shopify connect. Create ONE app at partners.shopify.com,
# set its redirect URL to {APP_BASE_URL}/api/integrations/shopify/oauth/callback,
# request read_orders + write_orders, and paste the app's Client ID/Secret here.
# Until set, merchants fall back to the manual access-token card.
# SHOPIFY_CLIENT_ID=""
# SHOPIFY_CLIENT_SECRET=""
# SHOPIFY_APP_SCOPES="read_orders,write_orders"

# API Key for the Demo Store
DEMO_API_KEY="" # generated automatically in step 4 below
DEMO_SEED_TOKEN="" # required in production to seed the demo store
```

### 3. Initialize the Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Start the Application & Generate the Demo Key
```bash
npm run dev
```
1. Open `http://localhost:3000/api/demo/seed` (in production, append `?token=<DEMO_SEED_TOKEN>`).
2. This route generates a mock merchant and prints a `DEMO_API_KEY` on screen.
3. Copy that key into `.env.local` as `DEMO_API_KEY="your_copied_key_here"`.
4. Restart the dev server.

---

## 🔑 Reviewer / Test Access

### Sign in without a real inbox
Clerk's test-mode email bypass is enabled by default in development instances:
1. Go to `/sign-in` or `/sign-up`.
2. Enter any email using the `+clerk_test` subaddress, e.g. `reviewer+clerk_test@payswift.dev`.
3. When asked for a verification code, enter the fixed code **`424242`**.
4. On first sign-in you'll land on `/onboarding` — enter any business name to reach the dashboard.

> This only works if Clerk's test-mode email addresses are enabled for your Clerk application (**Configure → Testing** in the Clerk Dashboard).

### Testing team roles and admin capabilities
The flow above gives you a single new organization where you're the `owner`. To evaluate RBAC — team roles (`owner`/`admin`/`developer`/`finance`) and admin console roles (`support`/`kyc_reviewer`/`finance`/`ops`/`superadmin`) — without manually creating and inviting each one by hand, run the demo-accounts seed script instead:

```bash
npx tsx scripts/seed-client-demo-accounts.ts
```

This provisions one organization with a `+clerk_test@` account for every merchant role, plus a separate `+clerk_test@` account for every admin role, so you can sign in as any of them using the same code-`424242` flow above. **It's idempotent but destructive on re-run** — it deletes and recreates its own demo users each time, so don't point it at an environment other reviewers are actively using. Check the script's header comment for the exact email addresses it creates and where its shared password is defined before running it.

---

## 🧪 Testing Guide

### 1. Full Payment Flow (UI, start to finish)
1. Sign up (or use Reviewer Access above) and complete onboarding with any business name.
2. Stay signed in — this is what links your test transactions to your own dashboard.
3. Go to the Demo Store (nav bar, or "Try Demo" on the landing page) and pick a product.
4. Enter a phone number — your own real Safaricom number for a genuine STK Push prompt, or Safaricom's shared sandbox test number `254708374149`. *(The Daraja Sandbox never moves real money.)*
5. Enter your M-Pesa PIN on your phone to complete the payment.
6. Return to Transactions — the result appears there, reflecting Safaricom's actual response.

> Testing the Demo Store while signed out records the transaction under a shared demo account, not your own dashboard — sign in first if you want to see your own results.

### 2. Manual Idempotency Verification
Because Vercel serverless functions can retry, and Safaricom can double-deliver webhooks, `/api/mpesa/callback` is built to immediately ignore any callback for a transaction already in a terminal state (`completed`/`failed`/`cancelled`).

1. **Seed a test transaction** — `npx prisma studio`, open `Transaction`, add a row: `merchantId` (any existing merchant), `amount: 100`, `phone: 254700000000`, `status: pending`, `checkoutRequestId: ws_CO_TEST_SUCCESS_001`.
2. **Send the first callback** (should process):
   ```bash
   curl -X POST http://localhost:3000/api/mpesa/callback \
     -H "Content-Type: application/json" \
     -d '{
     "Body": {
       "stkCallback": {
         "MerchantRequestID": "test-merchant-req-success",
         "CheckoutRequestID": "ws_CO_TEST_SUCCESS_001",
         "ResultCode": 0,
         "ResultDesc": "The service request is processed successfully.",
         "CallbackMetadata": {
           "Item": [
             { "Name": "Amount", "Value": 100 },
             { "Name": "MpesaReceiptNumber", "Value": "TES1234567" },
             { "Name": "TransactionDate", "Value": 20260717120000 },
             { "Name": "PhoneNumber", "Value": 254700000000 }
           ]
         }
       }
     }
   }'
   ```
   Expected: the transaction updates to `completed` in Prisma Studio.
3. **Resend the identical callback two more times.** Expected: both are skipped, no field changes, server logs `Transaction ... already in terminal state "completed". Skipping.` Both still return `{"success":true}` (HTTP 200) — this is intentional, so Safaricom's own retry logic is satisfied without any reprocessing happening.

### 3. Daraja Failure Paths (Asymmetric Trust)
PaySwift trusts Daraja's Query API **only** when it returns success (`ResultCode: 0`) — Safaricom's own docs note the Query API can return false failures for transactions that are actually still pending or already succeeded. Non-success query results are ignored; a transaction is only marked `expired` after a strict 30-minute timeout, to avoid false positives. The callback handler maps every Daraja `ResultCode` to one of three terminal statuses:

| ResultCode | Daraja Meaning | PaySwift Status | CallbackMetadata Present? |
|:---:|---|:---:|:---:|
| `0` | Transaction successful | `completed` | ✅ Yes |
| `1032` | Request cancelled by user | `cancelled` | ❌ No |
| `1037` | DS timeout (user didn't enter PIN) | `failed` | ❌ No |
| `2001` | Wrong PIN entered | `failed` | ❌ No |
| `1` | Insufficient funds | `failed` | ❌ No |
| Any other | Unrecognized failure | `failed` | ❌ No |

> Safaricom omits `CallbackMetadata` entirely on failure/cancellation callbacks — `MpesaReceiptNumber` only ever exists on `ResultCode: 0`.

To simulate each path locally, seed a `pending` transaction per test (unique `checkoutRequestId` each) via Prisma Studio, then POST the matching callback body to `/api/mpesa/callback`:

| Test | checkoutRequestId | ResultCode | ResultDesc | Expected status |
|---|---|:---:|---|:---:|
| User cancellation | `ws_CO_TEST_CANCEL_001` | `1032` | `Request cancelled by user` | `cancelled` |
| DS timeout | `ws_CO_TEST_TIMEOUT_001` | `1037` | `DS timeout user cannot be reached` | `failed` |
| Wrong PIN | `ws_CO_TEST_WRONGPIN_001` | `2001` | `The initiator information is invalid` | `failed` |
| Insufficient funds | `ws_CO_TEST_FUNDS_001` | `1` | `The balance is insufficient for the transaction` | `failed` |
| Success (control) | `ws_CO_TEST_SUCCESS_001` | `0` | `The service request is processed successfully.` | `completed` |

Each `curl` follows the same shape as the idempotency test above, swapping `CheckoutRequestID`/`ResultCode`/`ResultDesc` (and omitting `CallbackMetadata` for every non-zero code). Verify the final state of each row in Prisma Studio afterward.

**Checking it end-to-end:** poll `GET /api/v1/payments/status/TRANSACTION_ID` (header `x-api-key: YOUR_API_KEY`) to confirm the status/`resultDesc` surface correctly, and — if a `webhookUrl` is configured — confirm the matching outbound event fired: `ResultCode 0` → `payment.completed`, `1032` → `payment.cancelled`, anything else → `payment.failed`.

### 4. Live Testing with Ngrok
1. Install [ngrok](https://ngrok.com/) and run `ngrok http 3000`.
2. Copy the HTTPS URL it gives you (e.g. `https://a1b2-c3d4.ngrok-free.app`).
3. Set `NEXT_PUBLIC_APP_URL` in `.env.local` to that URL and restart the dev server.
4. Use the Demo Store as in Test 1 — Safaricom will send its success callback to your ngrok URL, which forwards it to your local database and updates the dashboard in real time.

---

## 🧑‍💻 Developer Integration

### SDK (recommended)
`payswift-node` is the official TypeScript/JavaScript client. **It's not published to npm yet** — it currently lives as a local package at `packages/payswift-node` (see that package's own README for full details); treat the example below as what the published API will look like once it ships.

```javascript
const { PaySwiftClient } = require('payswift-node');

const client = new PaySwiftClient(
  'sk_test_123456789',        // your API key
  'https://api.payswift.com'  // base URL — required, no default is configured yet
);

const result = await client.payments.initiate({ phone: '254700000000', amount: 1500 });
console.log(result.data.transactionId);
```

Covers `payments.initiate` / `payments.status`, `transactions.list` (cursor-paginated), `payouts.initiate`, `refunds.initiate`, and `c2b.registerUrls`. Every mutating call auto-generates an `Idempotency-Key` (or accepts your own), and transient network errors / `5xx` responses are retried up to 3 times with exponential backoff — 4xx errors are thrown immediately, not retried.

### REST API (any language)
```http
POST /api/v1/payments/initiate
Content-Type: application/json
x-api-key: YOUR_MERCHANT_API_KEY
```
```json
{
  "amount": 2500,
  "phone": "254708374149",
  "reference": "ORDER-12345",
  "description": "Payment for Shoes"
}
```
```json
{
  "success": true,
  "transactionId": "cm3r5xk9e...",
  "message": "Payment prompt sent to user"
}
```
Full endpoint reference and schemas: `/api/v1/openapi.json`, browsable at `/docs`.

### Webhooks
```json
{
  "event": "payment.completed",
  "data": {
    "transactionId": "cm3r5xk9e...",
    "orderReference": "ORDER-12345",
    "amount": 2500,
    "phone": "254708374149",
    "status": "completed",
    "mpesaReceiptNumber": "RTY5U6I7O8",
    "completedAt": "2024-05-20T10:30:00Z"
  }
}
```

**Verifying authenticity:**
1. Find your signing secret at Settings → Webhook Configuration (`whsec_...`).
2. Every webhook request carries an `x-payswift-signature` header.
3. Compute the HMAC-SHA256 of the **raw** request body using your signing secret and compare.

```typescript
import crypto from 'crypto';

const signatureHeader = req.headers['x-payswift-signature'];
const rawBody = await req.text(); // must be the raw JSON string, exactly as received
const signingSecret = process.env.PAYSWIFT_WEBHOOK_SECRET;

const expectedSignature = crypto
  .createHmac('sha256', signingSecret)
  .update(rawBody)
  .digest('hex');

if (crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))) {
  // valid — process payload
} else {
  // invalid — reject
}
```

Full event catalog and payload shapes for every event type: `/docs/webhooks`. Delivery history, retries, and a "send test event" button live at `/settings/webhooks` in the dashboard.

---

## 🛍️ Shopify Integration Guide

1. In Shopify Admin: **Settings → Apps and sales channels → Develop apps**. If an app already exists there from before 2026 with a visible API credentials tab, use it and skip to step 5.
2. Otherwise, create a new app via the **Dev Dashboard** — Distribution: **Custom**, install target: this store. Grant scopes `read_orders` and `write_orders`.
3. Copy the app's **Client ID** and **Client Secret**. Build this URL (replace `{shop}`, `{client_id}`, use this integration's Webhook URL — shown in PaySwift's Shopify settings card — as `redirect_uri`, and a random string as `state`) and open it while signed in as the store admin:
   `https://{shop}.myshopify.com/admin/oauth/authorize?client_id={client_id}&scope=read_orders,write_orders&redirect_uri={redirect_uri}&state={random_string}`
   Approve the install — Shopify redirects back with a `code` parameter; copy it.
4. Exchange the code for a permanent token:
   ```bash
   curl -X POST https://{shop}.myshopify.com/admin/oauth/access_token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -H 'Accept: application/json' \
     -d 'client_id={client_id}' \
     -d 'client_secret={client_secret}' \
     -d 'code={code}'
   ```
   The response's `access_token` (starts `shpat_`) goes in the Admin API Access Token field below. Don't add an `expiring` parameter — omitting it is what makes the token permanent. Your **Client Secret** from step 3 doubles as your Webhook Signing Secret.
5. In PaySwift → Settings → Shopify Integration: paste the store domain, access token, and webhook secret, Save, then Test Connection.
6. Copy the "Webhook URL to register in Shopify" value from that same card.
7. In Shopify Admin, add a webhook: Event = `Order creation`, Format = JSON, URL = the copied URL, API version = `2026-07`.
8. Place a test order with a valid Kenyan phone number and a KES total. Confirm an STK prompt fires, and that a paid order gets a note "Paid via M-Pesa — Receipt: XXXX" plus an `mpesa-paid` tag.

> This integration does **not** create a formal Shopify "payment gateway" checkout entry — it triggers M-Pesa payment *after* an order is created via any existing checkout method (e.g. Cash on Delivery), then confirms payment on top. Building a true Shopify Payments App requires Shopify's formal review process — out of scope here.

**Simulating a Shopify webhook locally** (no real store needed):
```bash
echo -n '{"id": 999999, "name": "#1001", "currency": "KES", "total_price": "100.00", "phone": "254700000000"}' | openssl dgst -sha256 -hmac "YOUR_WEBHOOK_SECRET" -binary | base64
```
```bash
curl -X POST http://localhost:3000/api/integrations/shopify/webhook \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: your-store.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: THE_BASE64_SIGNATURE_FROM_ABOVE" \
  -d '{"id": 999999, "name": "#1001", "currency": "KES", "total_price": "100.00", "phone": "254700000000"}'
```

---

## ⚙️ Operations & Maintenance

### Scheduled Jobs
Cron runs via an **external scheduler ([cron-job.org](https://cron-job.org))**, not Vercel Cron — there's no `vercel.json`. Each job is a `GET` endpoint authorized by `Authorization: Bearer <CRON_SECRET>`; auth **fails closed**, so `CRON_SECRET` must be set in production or every call is rejected.

| Endpoint | Schedule | Purpose |
|---|---|---|
| `GET /api/cron/reconcile-transactions` | every 2 min | STK self-heal for pending transactions |
| `GET /api/cron/reconcile-ledger` | daily 02:00 | Surface unresolved payouts/transactions/commands for admin review |
| `GET /api/cron/aggregate-usage` | daily 03:00 | Aggregate usage → invoices, advance billing periods |

Set the daily jobs' timezone to Africa/Nairobi. Full step-by-step in the deploy notes.

### Maintenance Scripts
- `npm run db:seed` (`scripts/seed-transactions.ts`) — seeds mock transactions into a local dev database.
- `npx tsx scripts/backfill-webhook-secrets.ts` — backfills `webhookSecret` for merchants that predate HMAC enforcement.
- `npx tsx scripts/backfill-organizations.ts` — one-off migration: creates a matching Clerk Organization + local Organization/Membership for every pre-multi-tenancy Merchant and cascades `organizationId` onto its ApiKey/Transaction rows. Must be run (and its zero-NULL verification confirmed) before any migration that makes `organizationId` `NOT NULL`.
- `npx tsx scripts/seed-qa-organization.ts` — idempotent; provisions a permanent, clearly-labeled QA Organization (with pooled sandbox Daraja credentials) for Playwright/CI use.
- `npx tsx scripts/repair-onboarding.ts` — idempotent, non-destructive; completes onboarding for any merchant left partially provisioned by a failed attempt.
- `npx tsx scripts/seed-client-demo-accounts.ts` — provisions a full RBAC test matrix (every merchant + admin role) for reviewers — see [Reviewer / Test Access](#-reviewer--test-access).
- `npx tsx scripts/daraja-sandbox-smoke.ts <organizationId> [stk|b2c|balance]` — **manual only, never run in CI**; smoke-tests one organization against Safaricom's real sandbox during go-live prep.

### Daraja API Suite
Every call resolves the initiating organization's **own** encrypted credentials — each merchant brings their own Safaricom shortcode, PaySwift never pools or shares live credentials across tenants.

| API | Endpoint / trigger | Notes |
|---|---|---|
| STK Push | `POST /api/v1/payments/initiate` | Customer-initiated collection |
| C2B | `POST /api/v1/c2b/register-urls` → callbacks at `/api/mpesa/c2b/*` | Direct Paybill/Till; confirmation idempotent on receipt |
| B2C payout | `POST /api/v1/payouts` | Result at `/api/mpesa/b2c/result` (sole writer of terminal status) |
| Refund | `POST /api/v1/refunds` | B2C back to the customer for a completed transaction |
| Transaction Status | `POST /api/v1/transactions/[id]/status-query` | Reconciliation only — never auto-heals |
| Account Balance | `POST /api/admin/organizations/[id]/account-balance` | Snapshots balance for ops alerting |
| Reversal | `POST /api/admin/payouts/[id]/reverse` (superadmin) | Undo a wrong payout; flips it to `reversed` |

B2C / Reversal / Account Balance require the organization's initiator name + password (entered during Payment Setup) and Safaricom's public certificate (`certs/{sandbox,production}.cer`) — the password is AES-encrypted at rest and RSA-encrypted per call to form the `SecurityCredential`. **Going live is admin-gated**: a merchant requests go-live (`POST /api/merchant/go-live/request`), a superadmin approves it (`POST /api/admin/organizations/[id]/go-live`, which validates the live credentials against Safaricom first). A nightly `reconcile-ledger` cron surfaces unresolved records for admin review without ever auto-failing them.

---

## ⚠️ Known Limitations
- **Sandbox by default.** New organizations transact against the Safaricom Daraja Sandbox until an admin approves their go-live request (see above) — production traffic requires completing Safaricom's own Go-Live KYC process first.
- **SDK not yet published.** `payswift-node` is source-available in this monorepo (`packages/payswift-node`) but not yet on npm.
- **Demo Store is a demonstration frontend only.** It exists to show the integration flow, not to replace a real e-commerce backend (like Shopify) — order fulfillment stays the merchant's own responsibility.