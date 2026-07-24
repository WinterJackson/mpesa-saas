import { z } from 'zod';
import { logger } from '@/lib/logger';

// ─── Environment Variable Schema ─────────────────────────────────────────────
// Every variable consumed by the backend is validated here.
// MPESA_CALLBACK_URL is validated as a URL to catch misconfiguration early.

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  MPESA_CONSUMER_KEY: z.string().min(1, 'MPESA_CONSUMER_KEY is required'),
  MPESA_CONSUMER_SECRET: z.string().min(1, 'MPESA_CONSUMER_SECRET is required'),
  MPESA_SHORTCODE: z.string().min(1, 'MPESA_SHORTCODE is required'),
  MPESA_PASSKEY: z.string().min(1, 'MPESA_PASSKEY is required'),
  MPESA_CALLBACK_URL: z.string().url('MPESA_CALLBACK_URL must be a valid URL'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  DEMO_SEED_TOKEN: z.string().optional(),
  MPESA_CONSUMER_KEY_LIVE: z.string().optional(),
  MPESA_CONSUMER_SECRET_LIVE: z.string().optional(),
  MPESA_SHORTCODE_LIVE: z.string().optional(),
  MPESA_PASSKEY_LIVE: z.string().optional(),
  MPESA_CALLBACK_URL_LIVE: z.string().url('MPESA_CALLBACK_URL_LIVE must be a valid URL').optional(),
  ENCRYPTION_KEY: z.string().min(44, 'ENCRYPTION_KEY must be a 32-byte base64 string'),
  // Optional: only set during a key-rotation window (see lib/crypto.ts's doc
  // comment / AGENTS.md runbook). Lets decryptSecret() still read rows
  // written under the previous ENCRYPTION_KEY while it's being retired.
  ENCRYPTION_KEY_PREVIOUS: z.string().min(44, 'ENCRYPTION_KEY_PREVIOUS must be a 32-byte base64 string').optional(),
  // Recommended in production, but OPTIONAL so local dev runs without an Upstash/
  // Sentry account. Every consumer reads these via process.env directly and
  // degrades gracefully when absent: rate-limit.ts falls back to a permissive
  // dummy limiter, idempotency.ts uses its Postgres fallback, the cron routes and
  // Sentry configs no-op. They are NOT read through this validated env proxy, so
  // marking them required only served to crash the app when unset (which is what
  // happened during local onboarding). Set them in production deployments.
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required').optional(),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url('NEXT_PUBLIC_SENTRY_DSN must be a valid URL').optional(),
  // Optional: KYC document storage (Cloudflare R2, S3-compatible). Not required
  // for the app to start — lib/storage.ts throws a clear error only when a KYC
  // upload is actually attempted without these configured.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  // Optional: Clerk webhook signing secret for app/api/webhooks/clerk/route.ts
  // (organization membership sync). Configure once Clerk Organizations +
  // webhooks are enabled in the Clerk Dashboard.
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  // Optional: Safaricom public certificate paths for the B2C/Reversal/Balance
  // SecurityCredential (lib/daraja-security-credential.ts). Defaults to
  // certs/sandbox.cer and certs/production.cer if unset. Public keys; git-ignored.
  MPESA_SANDBOX_CERT_PATH: z.string().optional(),
  MPESA_PRODUCTION_CERT_PATH: z.string().optional(),
  // Optional: platform base URL used to build Daraja Result/Timeout callback URLs
  // (B2C/C2B/reversal/balance point at OUR routes, same for every org). Falls back
  // to the STK callback URL's origin when unset.
  MPESA_CALLBACK_BASE_URL: z.string().url('MPESA_CALLBACK_BASE_URL must be a valid URL').optional(),
  // Optional: Shopify public app credentials for the one-click OAuth "Connect
  // Shopify" install flow (lib/shopify.ts + app/api/integrations/shopify/oauth/*).
  // ONE app installed by many stores. Until set, the OAuth wizard is dormant and
  // merchants fall back to the manual access-token card. CLIENT_SECRET also
  // verifies inbound Shopify webhooks (with a per-merchant secret fallback).
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_APP_SCOPES: z.string().optional(),
  // Optional: public base URL used to build the Shopify OAuth redirect_uri and
  // the auto-registered webhook address. Falls back to the request origin.
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL').optional(),
});

export type Env = z.infer<typeof envSchema>;

// ─── Lazy Validation ─────────────────────────────────────────────────────────
// Environment variables are validated lazily on first access, NOT at module load time.
// This prevents build failures when server-only env vars (like MPESA keys) aren't
// available during Vercel's static build phase, since build-time code never imports
// this module — only runtime server code does (via lib/daraja.ts, API routes, etc.).

let _env: Env | null = null;

function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
    MPESA_PASSKEY: process.env.MPESA_PASSKEY,
    MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DEMO_SEED_TOKEN: process.env.DEMO_SEED_TOKEN,
    MPESA_CONSUMER_KEY_LIVE: process.env.MPESA_CONSUMER_KEY_LIVE,
    MPESA_CONSUMER_SECRET_LIVE: process.env.MPESA_CONSUMER_SECRET_LIVE,
    MPESA_SHORTCODE_LIVE: process.env.MPESA_SHORTCODE_LIVE,
    MPESA_PASSKEY_LIVE: process.env.MPESA_PASSKEY_LIVE,
    MPESA_CALLBACK_URL_LIVE: process.env.MPESA_CALLBACK_URL_LIVE,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENCRYPTION_KEY_PREVIOUS: process.env.ENCRYPTION_KEY_PREVIOUS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    MPESA_SANDBOX_CERT_PATH: process.env.MPESA_SANDBOX_CERT_PATH,
    MPESA_PRODUCTION_CERT_PATH: process.env.MPESA_PRODUCTION_CERT_PATH,
    MPESA_CALLBACK_BASE_URL: process.env.MPESA_CALLBACK_BASE_URL,
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
    SHOPIFY_APP_SCOPES: process.env.SHOPIFY_APP_SCOPES,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });

  if (!result.success) {
    logger.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Missing or invalid environment variables. Check server logs for details.');
  }

  _env = result.data;
  return _env;
}

/**
 * Validated, typed environment variables.
 * Access via `env.DATABASE_URL`, `env.MPESA_CONSUMER_KEY`, etc.
 * Throws on first access if any required variable is missing/invalid.
 */
export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    const validated = validateEnv();
    return validated[prop as keyof Env];
  },
});
