# PaySwift — M-Pesa SaaS Platform

PaySwift is a production-ready, white-label Merchant SaaS platform that empowers businesses to seamlessly collect, monitor, and manage M-Pesa payments. Built on Next.js 15, Prisma, and Tailwind CSS, PaySwift offers a highly secure API integration layer, an interactive "Demo Store" for end-users to experience frictionless checkout, and a beautifully designed Dashboard for merchants to track their real-time transaction statuses via Webhooks.

## 🚀 Quick Start & Setup

### Prerequisites
- Node.js v18+
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

# Only required if you complete Safaricom's Go-Live KYC process and want to enable Live mode
# MPESA_CONSUMER_KEY_LIVE=""
# MPESA_CONSUMER_SECRET_LIVE=""
# MPESA_PASSKEY_LIVE=""
# MPESA_SHORTCODE_LIVE=""
# MPESA_CALLBACK_URL_LIVE=""

# Webhook Domain (Use Ngrok for local testing)
NEXT_PUBLIC_APP_URL="https://your-ngrok-domain.ngrok-free.app"

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

## 🔑 Reviewer / Test Login

To test the application without needing a real email address, you can use Clerk's test mode email bypass (enabled by default in development instances).

1. Go to the sign-in or sign-up page (`/sign-in` or `/sign-up`).
2. Enter any email address that includes the `+clerk_test` subaddress. For example: `reviewer+clerk_test@payswift.dev`
3. When prompted for the verification code, enter the fixed code: **`424242`**
4. This will bypass the email step and log you in.
5. After your first sign-in, you will land on the `/onboarding` page. Enter any business name to complete the setup and reach the dashboard.

> **Note:** This feature only works if the Clerk application has test mode/test email addresses enabled. You can enable this in the Clerk Dashboard under **Configure > Testing**.

---

## 🧪 End-to-End Testing (M-Pesa Callbacks)

To test the full lifecycle of a payment—including the Safaricom STK Push and the automated backend Webhooks—you must expose your local server to the public internet so Safaricom's servers can reach it.

### 1. Manual Idempotency Check (Local & Live)

Because Vercel Serverless can retry functions, and Safaricom can double-deliver webhooks, idempotency is critical. The `/api/mpesa/callback` endpoint is designed to immediately ignore requests for transactions that are already `completed` or `failed`.

To manually verify this behavior:

1. **Seed a Test Transaction**  
   Run `npx prisma studio`, open the `Transaction` table, and manually add a new row with these values:
   - `merchantId`: (Copy an existing ID from the Merchant table)
   - `amount`: `100`
   - `phone`: `254700000000`
   - `status`: `pending`
   - `checkoutRequestId`: `ws_CO_TEST_SUCCESS_001`

2. **Send the First Callback (Should Process)**  
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
   **Expected**: The transaction updates to `completed` in Prisma Studio.

3. **Send the Same Callback Two More Times (Should Skip Both Times)**  
   Run the exact same `curl` command twice more, back to back.  
   **Expected**: Both calls should log that they skipped the transaction, and no field on the transaction record should change.

**Verified Result (production-code test, run after the Neon/Turbopack connection fix):**

| Field | Before Duplicate Calls | After 1st Duplicate | After 2nd Duplicate |
|---|---|---|---|
| status | `completed` | `completed` (unchanged) | `completed` (unchanged) |
| resultCode | `0` | `0` (unchanged) | `0` (unchanged) |
| resultDesc | `"The service request is processed successfully."` | unchanged | unchanged |
| mpesaReceipt | `"TES1234567"` | unchanged | unchanged |
| updatedAt | `2026-07-18T09:50:05.514Z` | unchanged | unchanged |

**Server log output for both duplicate deliveries:**
```
[Callback] Transaction test_success_001 already in terminal state "completed". Skipping.
```
Both duplicate calls returned `{"success":true}` (HTTP 200) in ~1.0-1.05s, confirming Safaricom's retry mechanism is satisfied without any reprocessing occurring. The unchanged `updatedAt` timestamp across three total delivery attempts is direct proof the idempotency guard works correctly — a bug here would show up as a changed timestamp even if the response body looked identical.

### 3. Failure-Path Testing (ResultCode Simulation)

PaySwift maps every Daraja `ResultCode` to one of three terminal statuses. This is the complete mapping implemented in `/api/mpesa/callback`:

| ResultCode | Daraja Meaning | PaySwift Status | CallbackMetadata Present? |
|:---:|---|:---:|:---:|
| `0` | Transaction successful | `completed` | ✅ Yes |
| `1032` | Request cancelled by user | `cancelled` | ❌ No |
| `1037` | DS timeout (user didn't enter PIN) | `failed` | ❌ No |
| `2001` | Wrong PIN entered | `failed` | ❌ No |
| `1` | Insufficient funds | `failed` | ❌ No |
| Any other | Unrecognized failure | `failed` | ❌ No |

> **Important:** Safaricom omits `CallbackMetadata` entirely on failure/cancellation callbacks. The `MpesaReceiptNumber` field only exists on `ResultCode: 0` (success). PaySwift's callback handler is built to handle this correctly.

To simulate each failure path locally, first seed a pending transaction for each test (use unique `checkoutRequestId` values):

**Step 1: Seed test transactions via Prisma Studio**

Run `npx prisma studio`, open the `Transaction` table, and create the following rows (use any valid `merchantId` from your `Merchant` table):

| checkoutRequestId | amount | phone | status |
|---|:---:|---|:---:|
| `ws_CO_TEST_CANCEL_001` | `100` | `254700000000` | `pending` |
| `ws_CO_TEST_TIMEOUT_001` | `100` | `254700000000` | `pending` |
| `ws_CO_TEST_WRONGPIN_001` | `100` | `254700000000` | `pending` |
| `ws_CO_TEST_FUNDS_001` | `100` | `254700000000` | `pending` |
| `ws_CO_TEST_SUCCESS_001` | `100` | `254700000000` | `pending` |

**Step 2: Simulate each callback**

#### Test A — User Cancellation (ResultCode 1032 → `cancelled`)
```bash
curl -X POST http://localhost:3000/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "test-merchant-req-cancel",
      "CheckoutRequestID": "ws_CO_TEST_CANCEL_001",
      "ResultCode": 1032,
      "ResultDesc": "Request cancelled by user"
    }
  }
}'
```
**Expected:** Transaction status → `cancelled`, resultCode → `1032`, resultDesc → `"Request cancelled by user"`.

#### Test B — DS Timeout (ResultCode 1037 → `failed`)
```bash
curl -X POST http://localhost:3000/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "test-merchant-req-timeout",
      "CheckoutRequestID": "ws_CO_TEST_TIMEOUT_001",
      "ResultCode": 1037,
      "ResultDesc": "DS timeout user cannot be reached"
    }
  }
}'
```
**Expected:** Transaction status → `failed`, resultCode → `1037`, resultDesc → `"DS timeout user cannot be reached"`.

#### Test C — Wrong PIN (ResultCode 2001 → `failed`)
```bash
curl -X POST http://localhost:3000/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "test-merchant-req-wrongpin",
      "CheckoutRequestID": "ws_CO_TEST_WRONGPIN_001",
      "ResultCode": 2001,
      "ResultDesc": "The initiator information is invalid"
    }
  }
}'
```
**Expected:** Transaction status → `failed`, resultCode → `2001`, resultDesc → `"The initiator information is invalid"`.

#### Test D — Insufficient Funds (ResultCode 1 → `failed`)
```bash
curl -X POST http://localhost:3000/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "test-merchant-req-funds",
      "CheckoutRequestID": "ws_CO_TEST_FUNDS_001",
      "ResultCode": 1,
      "ResultDesc": "The balance is insufficient for the transaction"
    }
  }
}'
```
**Expected:** Transaction status → `failed`, resultCode → `1`, resultDesc → `"The balance is insufficient for the transaction"`.

#### Test E — Successful Payment (ResultCode 0 → `completed`, control test)
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
          { "Name": "Balance" },
          { "Name": "TransactionDate", "Value": 20260717120000 },
          { "Name": "PhoneNumber", "Value": 254700000000 }
        ]
      }
    }
  }
}'
```
**Expected:** Transaction status → `completed`, resultCode → `0`, mpesaReceipt → `"TES1234567"`.

**Step 3: Verify results**

Open Prisma Studio and confirm the final state of each transaction:

| checkoutRequestId | Expected status | Expected resultCode | mpesaReceipt |
|---|:---:|:---:|:---:|
| `ws_CO_TEST_CANCEL_001` | `cancelled` | `1032` | `null` |
| `ws_CO_TEST_TIMEOUT_001` | `failed` | `1037` | `null` |
| `ws_CO_TEST_WRONGPIN_001` | `failed` | `2001` | `null` |
| `ws_CO_TEST_FUNDS_001` | `failed` | `1` | `null` |
| `ws_CO_TEST_SUCCESS_001` | `completed` | `0` | `TES1234567` |

#### Demo Store UI Verification

If you poll any of the failed/cancelled transactions via the status API, the Demo Store's checkout dialog will render the failure state with the `resultDesc` from the callback. To verify:

1. After running curl Tests A–D above, call the status endpoint for each transaction:
   ```bash
   curl http://localhost:3000/api/v1/payments/status/TRANSACTION_ID \
     -H "x-api-key: YOUR_API_KEY"
   ```
2. Confirm the response contains `"status": "cancelled"` or `"status": "failed"` with the matching `resultDesc`.

#### Webhook Event Verification

If the merchant has a `webhookUrl` configured, PaySwift fires outbound webhook events for every terminal status. The `event` field reflects the exact status:

| ResultCode | Webhook Event |
|:---:|---|
| `0` | `payment.completed` |
| `1032` | `payment.cancelled` |
| Any other | `payment.failed` |

### 4. Live Testing with Ngrok
1. Download and install [Ngrok](https://ngrok.com/).
2. Run Ngrok on port 3000:
   ```bash
   ngrok http 3000
   ```
3. Copy the public HTTPS URL provided by Ngrok (e.g., `https://a1b2-c3d4.ngrok-free.app`).
4. Update `NEXT_PUBLIC_APP_URL` in your `.env.local` file to match this Ngrok URL.
5. Restart your Next.js server.
6. Test a payment using the Demo Store! 
   - **Note:** If you're signed in with your own merchant account, transactions from the Demo Store will automatically appear on your dashboard in real time. If you're just browsing without an account, demo transactions use a shared test account instead.
   - **Phone Number:** You can enter your own Safaricom number to receive a real STK Push prompt on your phone, or use Safaricom's shared sandbox test number `254708374149` if you prefer not to use your own.

   When you send the prompt, Safaricom will send the success callback to your Ngrok URL, which forwards it to your local database, updating the Dashboard in real-time.

---

## 📖 API Reference

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

**Success Response (200 OK):**
```json
{
  "success": true,
  "transactionId": "cm3r5xk9e...",
  "message": "Payment prompt sent to user"
}
```

---

## ⚡ Webhook Payload Shape

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

### Verifying Webhook Authenticity

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

## 🛍️ Shopify Integration Guide

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
9. Note explicitly: this integration does NOT create a formal Shopify "payment gateway" entry in checkout — it triggers payment AFTER an order is created via any existing checkout/payment method Shopify already supports (e.g. "Cash on Delivery" or a manual payment method), and then confirms M-Pesa payment on top. This is intentional: building a true Shopify Payments App requires Shopify's formal review process, which is out of scope for this MVP.

### Simulating a Shopify Webhook Locally

To verify your Shopify webhook receiver locally without a real Shopify store, you can simulate a payload and its HMAC signature using `curl` and `openssl`.

1. Generate a valid HMAC signature for your test payload:
```bash
# Replace YOUR_WEBHOOK_SECRET with your configured test secret
echo -n '{"id": 999999, "name": "#1001", "currency": "KES", "total_price": "100.00", "phone": "254700000000"}' | openssl dgst -sha256 -hmac "YOUR_WEBHOOK_SECRET" -binary | base64
```

2. Send the simulated webhook with the generated signature:
```bash
curl -X POST http://localhost:3000/api/integrations/shopify/webhook \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: your-store.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: THE_BASE64_SIGNATURE_FROM_ABOVE" \
  -d '{"id": 999999, "name": "#1001", "currency": "KES", "total_price": "100.00", "phone": "254700000000"}'
```

---

## 🛠️ Maintenance Scripts

The repository includes utility scripts for operational maintenance:

- `npm run db:seed` (via `scripts/seed-transactions.ts`): Safely seeds mock transactions into a local development database.
- `npx tsx scripts/backfill-webhook-secrets.ts`: Operational script to backfill `webhookSecret` fields for existing merchants who registered prior to HMAC signature enforcement.

---

## ⚠️ Known Limitations
- **Sandbox Environment Only:** The platform is currently hardcoded to use the Safaricom Daraja Sandbox environment. 
- **Production Verification:** To move to production, you must update the Daraja endpoints from `sandbox.safaricom.co.ke` to `api.safaricom.co.ke` and complete Safaricom's rigorous Go-Live KYC process.
- **Demo Store:** The included Demo Store is a mock frontend designed strictly to demonstrate integration workflow. It does not replace a functional e-commerce backend (like Shopify) which should manage order fulfillment independently.
