# PaySwift — M-Pesa SaaS Platform

PaySwift is a production-ready, white-label Merchant SaaS platform that empowers businesses to seamlessly collect, monitor, and manage M-Pesa payments. Built on Next.js 15, Prisma, and Tailwind CSS, PaySwift offers a highly secure API integration layer, an interactive "Demo Store" for end-users to experience frictionless checkout, and a beautifully designed Dashboard for merchants to track their real-time transaction statuses via Webhooks.

## 🚀 Quick Start & Setup

### Prerequisites
- Node.js v18+
- A PostgreSQL database (e.g., Neon DB)
- Clerk API keys (for Authentication)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/mpesa-saas.git
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
1. Open your browser to `http://localhost:3000/api/demo/seed`.
2. This route will securely generate a mock merchant and output a `DEMO_API_KEY` on the screen.
3. Copy that key into your `.env.local` file as `DEMO_API_KEY="your_copied_key_here"`.
4. Restart your development server (`Ctrl+C` then `npm run dev`).

---

## 🧪 End-to-End Testing (M-Pesa Callbacks)

To test the full lifecycle of a payment—including the Safaricom STK Push and the automated backend Webhooks—you **must** expose your local server to the public internet so Safaricom's servers can reach it.

### Using Ngrok (Recommended)
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
