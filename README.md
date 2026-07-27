# PaySwift — M-Pesa SaaS Platform

PaySwift is a production-ready, white-label Merchant SaaS platform that empowers businesses to seamlessly collect, monitor, and manage M-Pesa payments. Built on Next.js 16, Prisma, and Tailwind CSS, PaySwift offers a highly secure API integration layer, an interactive "Demo Store" for end-users to experience frictionless checkout, and a beautifully designed Dashboard for merchants to track their real-time transaction statuses via Webhooks.

## Table of Contents
1. [Features](#features)
2. [Quick Start & Setup](#quick-start--setup)
3. [Demo & Reviewer Access](#demo--reviewer-access)
4. [API Reference](#api-reference)
5. [Shopify Integration](#shopify-integration)
6. [Daraja API Suite Reference](#daraja-api-suite-reference)
7. [Operations](#operations)
8. [Detailed Manual QA & Testing](#detailed-manual-qa--testing)
9. [Known Limitations](#known-limitations)

---

## Features

### Payments & Payment Links
- **No-code Payment Links** — create a link in the dashboard (fixed or customer-set amount), share it, show its **QR code**, or paste the embeddable **"Pay with M-Pesa"** button on any site. Customers pay on a PaySwift-hosted checkout at `/pay/[slug]`.
- **Dashboard Sandbox/Live view filter** (a list-view filter, separate from the admin-gated payment-routing switch).

### Developer API & Webhooks
- **Frozen REST API** at `/api/v1` with an **OpenAPI 3.1** spec (`/api/v1/openapi.json`) and an interactive reference at **`/docs`**.
- **Cursor pagination** (`GET /api/v1/transactions`, `{ data, nextCursor }`), **per-plan rate limits** (`X-RateLimit-*` headers, `429` + `Retry-After`).
- **Webhooks** — a canonical event catalog (incl. `payout.reversed`), a **delivery inspector** at `/settings/webhooks` with payload viewer and one-click **redelivery**, and a signed **test event**. See `/docs/webhooks`.

### Security & Compliance
- **Database-level tenant isolation** — Postgres Row-Level Security on `WebhookDelivery`/`Refund` as defense-in-depth behind the repository-layer `organizationId` scoping. The app connects as a restricted `app_runtime` role (`DATABASE_APP_URL`) so RLS actually enforces; `DATABASE_URL` (owner) is migrations-only. See AGENTS.md.
- **Rotatable encryption keys** — `ENCRYPTION_KEY` can rotate with `ENCRYPTION_KEY_PREVIOUS` bridging existing rows (no downtime, no backfill required).
- **Compliance groundwork (Kenya DPA)** — self-service data export and an admin-reviewed data-deletion request flow (deletion is never auto-executed). Runbooks: `scripts/restore-drill.md` (Neon PITR DR) and `scripts/incident-response.md` (Sev scale + breach notification). Reliability/SLA docs at `/docs/reliability`.
- **CI hardening** — gitleaks secret scanning and `npm audit` (critical) added, alongside the existing CodeQL + Dependabot.

### Observability & Reliability
- **Durable webhook delivery** via Inngest (optional; webhook-delivery only — cron stays on cron-job.org). Dormant until `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` are set; falls back to direct delivery otherwise.
- **Tracing** — Sentry spans around every outbound Daraja call and webhook dispatch, tagged per-organization (never PII).
- **Public status page** at `/status`, backed by an `app/api/cron/health-check` self-check (DB, Redis, Daraja sandbox).
- **Read-replica-ready** — read-heavy admin/reporting queries route through `prismaReadonly`; set `DATABASE_REPLICA_URL` to point them at a Neon replica when needed.
- **Transactional email (Resend)** — branded business-workflow notifications across the lifecycle. Clerk still owns all identity/auth email. Optional and fail-open.

---

## Quick Start & Setup

### Prerequisites
- Node.js v20.9+
- A PostgreSQL database (e.g., Neon DB)
- Clerk API keys (for Authentication)

### 1. Clone & Install
```bash
git clone https://github.com/WinterJackson/mpesa-saas.git
cd mpesa-saas
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root of your project and populate it with the following:

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

# REQUIRED Infrastructure Variables (System will fail to start without these)
ENCRYPTION_KEY="..." # 32-byte base64 AES-256-GCM key — generate with: openssl rand -base64 32
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
CRON_SECRET="..."
NEXT_PUBLIC_SENTRY_DSN="https://..."

# These are currently unused by the live credential-resolution path — live credentials are supplied per-organization via the onboarding Payment Setup step, not via global env vars.
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

# Optional (Phase 2) — Safaricom public certs for the B2C/Reversal/Balance
# SecurityCredential (public keys, git-ignored under certs/). Default paths are
# certs/sandbox.cer and certs/production.cer.
# MPESA_SANDBOX_CERT_PATH="./certs/sandbox.cer"
# MPESA_PRODUCTION_CERT_PATH="./certs/production.cer"
# Optional — base URL for Daraja Result/Timeout callbacks (they hit OUR routes).
# Falls back to MPESA_CALLBACK_URL's origin. Point at a fixed-IP proxy if
# Safaricom requires a static outbound IP for production go-live.
# MPESA_CALLBACK_BASE_URL=""

# Webhook Domain (Use Ngrok for local testing)
NEXT_PUBLIC_APP_URL="https://your-ngrok-domain.ngrok-free.app"

# Optional (Phase 3) — public base URL used to build the Shopify OAuth redirect
# and auto-registered webhook address. Falls back to the request origin.
# APP_BASE_URL=""

# Optional (Billing) — PaySwift's OWN M-Pesa collector for subscription billing.
# The Paybill merchants' subscription fees are charged INTO (distinct from any
# merchant's own shortcode). Until set, subscription billing FALLS BACK to the
# pooled sandbox credentials (MPESA_* above) so the STK billing + dunning flow is
# fully demonstrable in sandbox. Callback falls back to
# {MPESA_CALLBACK_BASE_URL or MPESA_CALLBACK_URL origin}/api/mpesa/billing/callback.
# PLATFORM_BILLING_CONSUMER_KEY=""
# PLATFORM_BILLING_CONSUMER_SECRET=""
# PLATFORM_BILLING_SHORTCODE=""
# PLATFORM_BILLING_PASSKEY=""
# PLATFORM_BILLING_CALLBACK_URL=""
# PLATFORM_BILLING_ENV="sandbox" # sandbox | live (defaults to live when a Paybill is set)

# Optional (Billing/Tax) — PaySwift's own KRA tax identity for the invoices it
# issues. Until PLATFORM_VAT_REGISTERED="true", invoices are interim non-tax
# documents (VAT 0, no eTIMS/CU number). Flip the flag + set the PIN once
# VAT-registered; the eTIMS OSCU integration then stamps the CU number.
# PLATFORM_KRA_PIN=""
# PLATFORM_VAT_REGISTERED="false"

# Optional (Phase 3) — one-click Shopify connect. Create ONE app at
# partners.shopify.com, set its redirect URL to
# {APP_BASE_URL}/api/integrations/shopify/oauth/callback, request read_orders +
# write_orders, and paste the app's Client ID/Secret here. Until set, merchants
# fall back to the manual access-token card.
# SHOPIFY_CLIENT_ID=""
# SHOPIFY_CLIENT_SECRET=""
# SHOPIFY_APP_SCOPES="read_orders,write_orders"

# API Key for the Demo Store
DEMO_API_KEY="" # You will generate this automatically in step 4
DEMO_SEED_TOKEN="" # Required in production to seed the demo store
```

### 3. Initialize the Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Start the Application & Generate the Demo Key
Run the development server:
```bash
npm run dev
```
1. Open your browser to `http://localhost:3000/api/demo/seed`. (In production, append `?token=<DEMO_SEED_TOKEN>` to the URL).
2. This route will securely generate a mock merchant and output a `DEMO_API_KEY` on the screen.
3. Copy that key into your `.env.local` file as `DEMO_API_KEY="your_copied_key_here"`.
4. Restart your development server (`Ctrl+C` then `npm run dev`).

---

## Demo & Reviewer Access

### Reviewer / Test Login
To test the application without needing a real email address, you can use Clerk's test mode email bypass (enabled by default in development instances).

1. Go to the sign-in or sign-up page (`/sign-in` or `/sign-up`).
2. Enter any email address that includes the `+clerk_test` subaddress. For example: `reviewer+clerk_test@payswift.dev`
3. When prompted for the verification code, enter the fixed code: **`424242`**
4. This will bypass the email step and log you in.
5. After your first sign-in, you will land on the `/onboarding` page. Enter any business name to complete the setup and reach the dashboard.

> **Note:** This feature only works if the Clerk application has test mode/test email addresses enabled. You can enable this in the Clerk Dashboard under **Configure > Testing**.

### Testing the Full Payment Flow (Start to Finish)
1. Sign up for an account (or use the Reviewer Login credentials above).
2. Complete onboarding by entering a business name.
3. You'll land on your dashboard — currently empty for a new account.
4. IMPORTANT: Stay signed in for the rest of this flow — this is what links your test transactions to your own dashboard.
5. Go to the Demo Store (via the nav bar, or "Try Demo" on the landing page).
6. Pick any product and click "Buy with M-Pesa."
7. Enter a phone number — you can use your own real Safaricom number to receive a genuine STK Push prompt on your phone, or use Safaricom's shared sandbox test number 254708374149 if you'd rather not use your own. *(Note: The Daraja Sandbox for testing does not cut real money from the person's M-Pesa account).*
8. Check your phone and enter your M-Pesa PIN to complete the payment.
9. Return to your Dashboard (or the Transactions page) — the transaction will appear there, reflecting the real result from Safaricom.

Note: if you test the Demo Store while NOT signed in, transactions are recorded under a shared demo account instead, and won't appear on any personal dashboard. Sign in first if you want to see your own results.

---

## API Reference

Merchant websites securely communicate with PaySwift via the following endpoint:

### `POST /api/v1/payments/initiate`

**Headers:**
```http
Content-Type: application/json
x-api-key: YOUR_MERCHANT_API_KEY
```

**Request Body:**
```json
{
  "amount": 2500,
  "phone": "254708374149",
  "reference": "ORDER-12345",
  "description": "Payment for Shoes"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "transactionId": "cm3r5xk9e...",
    "checkoutRequestId": "ws_CO_TEST_SUCCESS_001",
    "status": "pending",
    "merchantRequestID": "test-merchant-req-success",
    "customerMessage": "Success. Request accepted for processing"
  }
}
```

### Developer SDK

The official Node.js SDK for PaySwift is located at `packages/payswift-node` and strongly-types all interaction.

```javascript
const { PaySwiftClient } = require('payswift-node');

const client = new PaySwiftClient(
  'sk_test_123456789', // Your API key
  'https://api.payswift.com' // Explicit base URL
);

async function processPayment() {
  try {
    // Initiating a payment auto-generates an Idempotency-Key UUID.
    // Network errors and 5xx errors are automatically retried via exponential backoff.
    const result = await client.payments.initiate({
      phone: '254700000000',
      amount: 1500,
    });
    
    console.log('Payment initiated successfully:', result.data.transactionId);
  } catch (error) {
    // 4xx errors are thrown immediately
    console.error('Failed to initiate payment:', error.message);
  }
}
```
The SDK provides types that are in sync with the backend schema validation.

### Webhook Payload Shape

When a payment succeeds or fails, PaySwift triggers an internal webhook to update the transaction record. If you are extending this to notify a merchant's external backend, the payload shape sent from PaySwift looks like this:

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

#### Verifying Webhook Authenticity

PaySwift secures all outbound webhooks using HMAC-SHA256 signatures to ensure payloads are not tampered with and originate from PaySwift.

1. **Obtain your Signing Secret:** Navigate to **Settings > Webhook Configuration** in the Dashboard to view your `whsec_...` secret.
2. **Read the Signature:** Every webhook request includes an `x-payswift-signature` header.
3. **Verify the Payload:** Compute the HMAC-SHA256 hash of the raw request body using your signing secret, and compare it against the header.

**Node.js / TypeScript Example:**
```typescript
import crypto from 'crypto';

const signatureHeader = req.headers['x-payswift-signature'];
// Must be the raw JSON string exactly as received
const rawBody = await req.text(); 
const signingSecret = process.env.PAYSWIFT_WEBHOOK_SECRET;

const expectedSignature = crypto
  .createHmac('sha256', signingSecret)
  .update(rawBody)
  .digest('hex');

if (crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))) {
  // Signature is valid, process payload
} else {
  // Invalid signature, reject request
}
```

---

## Shopify Integration

### 1-Click OAuth Connect (Primary Path)

If your platform has `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` configured in `.env.local`:
1. Merchants simply go to the `/integrations` tab on their Dashboard.
2. They enter their `.myshopify.com` domain and click **Connect**.
3. They approve the app on Shopify. They are redirected back already connected. No manual webhooks or app configuration is needed!

### Manual Fallback

If one-click connect isn't configured on this platform yet, or a merchant needs to connect a store manually, use this process instead:

1. In Shopify Admin, go to **Settings → Apps and sales channels → Develop apps**. If an app already exists there from before 2026 with a visible API credentials tab, use it and skip to step 5 below — the old flow still works for that app.
2. Otherwise you'll be sent to the **Dev Dashboard** to create a new app. Set Distribution to **Custom**, install target: this store. Grant scopes `read_orders` and `write_orders`.
3. Copy the app's **Client ID** and **Client Secret**. Build this URL (replace `{shop}`, `{client_id}`, and use this integration's Webhook URL shown below as the `redirect_uri`, with a random string as `state`), and open it in a browser while logged in as the store admin:
   `https://{shop}.myshopify.com/admin/oauth/authorize?client_id={client_id}&scope=read_orders,write_orders&redirect_uri={redirect_uri}&state={random_string}`
   Approve the install. Shopify redirects to your `redirect_uri` with a `code` parameter in the URL — copy that code.
4. Exchange the code for a permanent token:
   ```bash
   curl -X POST https://{shop}.myshopify.com/admin/oauth/access_token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -H 'Accept: application/json' \
     -d 'client_id={client_id}' \
     -d 'client_secret={client_secret}' \
     -d 'code={code}'
   ```
   The response's `access_token` field (starts with `shpat_`) is what goes in the Admin API Access Token field below. Do not add an `expiring` parameter to this request — omitting it is what makes the token permanent. Your **Client Secret** from step 3 is your Webhook Signing Secret (it signs both this exchange and incoming webhooks — the Dev Dashboard has no separately-labeled "webhook secret").
5. In PaySwift's dashboard → Settings → Shopify Integration, paste the store domain, access token, and webhook secret, then click Save, then Test Connection to confirm.
6. Copy the "Webhook URL to register in Shopify" value from that same card.
7. In Shopify Admin → Settings → Notifications → Webhooks (or via the custom app's Webhooks subscription tab, depending on Shopify's current UI), add a new webhook: Event = `Order creation`, Format = JSON, URL = the copied URL from step 6, API version = `2026-07`.
8. Place a test order in the Shopify store with a valid Kenyan phone number on the order (customer phone or shipping address phone) and a KES total. Confirm an M-Pesa STK prompt is sent to that number, and that once paid, the order in Shopify gets a note "Paid via M-Pesa — Receipt: XXXX" and an `mpesa-paid` tag.

> **Note explicitly:** this integration does NOT create a formal Shopify "payment gateway" entry in checkout — it triggers payment AFTER an order is created via any existing checkout/payment method Shopify already supports (e.g. "Cash on Delivery" or a manual payment method), and then confirms M-Pesa payment on top. This is intentional: building a true Shopify Payments App requires Shopify's formal review process, which is out of scope for this MVP.

---

## Daraja API Suite Reference

Every call resolves the initiating organization's own encrypted credentials (Model B):

| API | Endpoint / trigger | Notes |
|---|---|---|
| STK Push | `POST /api/v1/payments/initiate` | Customer-initiated collection |
| C2B | `POST /api/v1/c2b/register-urls` → callbacks at `/api/mpesa/c2b/*` | Direct Paybill/Till; confirmation idempotent on receipt |
| B2C payout | `POST /api/v1/payouts` | Result at `/api/mpesa/b2c/result` (sole writer of terminal status) |
| Refund | `POST /api/v1/refunds` | B2C back to the customer for a completed transaction |
| Transaction Status | `POST /api/v1/transactions/[id]/status-query` | Reconciliation only — never auto-heals (guardrail #4) |
| Account Balance | `POST /api/admin/organizations/[id]/account-balance` | Snapshots balance for ops alerting |
| Reversal | `POST /api/admin/payouts/[id]/reverse` (superadmin) | Undo a wrong payout; flips it to `reversed` |

B2C / Reversal / Account Balance require the org's **initiator name + password** (entered in Payment Setup) and Safaricom's public **certificate** (`certs/{sandbox,production}.cer`) — the password is AES-encrypted at rest and RSA-encrypted per call to form the `SecurityCredential`. **Going live** is admin-gated: a merchant requests go-live (`POST /api/merchant/go-live/request`), a superadmin approves it (`POST /api/admin/organizations/[id]/go-live`, which validates the live credentials against Safaricom first). Idempotency (`Idempotency-Key` header) covers payments/payouts/refunds with a Redis fast path + durable Postgres fallback. A nightly `reconcile-ledger` cron surfaces unresolved records for admin review without ever auto-failing them.

---

## Operations

### Scheduled Jobs (cron-job.org)

Cron is run by an **external scheduler ([cron-job.org](https://cron-job.org))**, not Vercel Cron (there is no `vercel.json`). Each job is a `GET` endpoint authorized by an `Authorization: Bearer <CRON_SECRET>` header — the auth **fails closed**, so `CRON_SECRET` MUST be set in the production environment or every cron call is rejected.

| Endpoint | Schedule | Purpose |
|---|---|---|
| `GET /api/cron/process-billing` | every few hours | Executes the dunning operational flow (retry/suspension) for past-due SaaS subscriptions. |
| `GET /api/cron/health-check` | every few minutes | Validates the operational status of Redis and the Database for the public status page. |
| `GET /api/cron/reconcile-transactions` | every 2 min (`*/2 * * * *`) | STK self-heal for pending transactions |
| `GET /api/cron/reconcile-ledger` | daily 02:00 | Surface unresolved payouts/transactions/commands for admin review |
| `GET /api/cron/aggregate-usage` | daily 03:00 | Aggregate usage → invoices, advance billing periods |

**Setup:** create one cron-job.org job per row above, pointing at your deployed URL, method `GET`, with a request header `Authorization: Bearer <your CRON_SECRET>`. Set the daily jobs' timezone to Africa/Nairobi. (Full step-by-step is in the deploy notes.)

### Maintenance Scripts

The repository includes utility scripts for operational maintenance:

- `npx tsx scripts/seed-transactions.ts`: Safely seeds mock transactions into a local development database.
- `npx tsx scripts/backfill-webhook-secrets.ts`: Operational script to backfill `webhookSecret` fields for existing merchants who registered prior to HMAC signature enforcement.
- `npx tsx scripts/backfill-organizations.ts`: One-off Phase 1 migration script — creates a matching Clerk Organization + local Organization/Membership for every pre-Phase-1 Merchant and cascades `organizationId` onto its existing ApiKey/Transaction rows. Must be run (and its zero-NULL verification confirmed) before the follow-up migration that makes `organizationId` `NOT NULL`.
- `npx tsx scripts/seed-qa-organization.ts`: Idempotent — provisions a permanent, clearly-labeled QA Organization (with pooled sandbox Daraja credentials) for Playwright/CI use, so E2E runs don't have to create a fresh Clerk user and walk the onboarding wizard every time.
- `npx tsx scripts/repair-onboarding.ts`: Idempotent, non-destructive — completes onboarding for any existing merchant whose provisioning is incomplete (seeds pooled sandbox credentials, ensures a Starter trial subscription, sets the Clerk `onboarded` flag). Fixes merchants left partial by a failed onboarding attempt and the Phase-1-backfilled orgs.
- `npx tsx scripts/daraja-sandbox-smoke.ts <organizationId> [stk|b2c|balance]`: **Manual** smoke test against Safaricom's real sandbox for one organization. Never run in CI — it depends on live sandbox availability. Use during go-live prep to confirm the full chain end-to-end.

---

## Detailed Manual QA & Testing

For an extensive walk-through of idempotency testing and manually verifying the Daraja callbacks and various failure states (Insufficient Funds, Cancellation, etc.), see the dedicated **[TESTING.md](TESTING.md)** document.

---

## Known Limitations
- **Sandbox Environment Only:** The platform is currently hardcoded to use the Safaricom Daraja Sandbox environment. 
- **Production Verification:** To move to production, you must update the Daraja endpoints from `sandbox.safaricom.co.ke` to `api.safaricom.co.ke` and complete Safaricom's rigorous Go-Live KYC process.
- **Demo Store:** The included Demo Store is a mock frontend designed strictly to demonstrate integration workflow. It does not replace a functional e-commerce backend (like Shopify) which should manage order fulfillment independently.
