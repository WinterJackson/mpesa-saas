import { z } from 'zod';

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
  });

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
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
