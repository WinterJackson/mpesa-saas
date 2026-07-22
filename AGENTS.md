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
