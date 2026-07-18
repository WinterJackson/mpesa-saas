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
6. Test a payment using the Demo Store! When you send the prompt, Safaricom will send the success callback to your Ngrok URL, which forwards it to your local database, updating the Dashboard in real-time.

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

---

## ⚠️ Known Limitations
- **Sandbox Environment Only:** The platform is currently hardcoded to use the Safaricom Daraja Sandbox environment. 
- **Production Verification:** To move to production, you must update the Daraja endpoints from `sandbox.safaricom.co.ke` to `api.safaricom.co.ke` and complete Safaricom's rigorous Go-Live KYC process.
- **Demo Store:** The included Demo Store is a mock frontend designed strictly to demonstrate integration workflow. It does not replace a functional e-commerce backend (like Shopify) which should manage order fulfillment independently.
