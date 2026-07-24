import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// ─── Prisma 7 + NeonDB Serverless Adapter (current, simplified API) ─────────
// As of the current @prisma/adapter-neon release, PrismaNeon accepts a plain
// { connectionString } object directly. Manual Pool construction, the `ws`
// package, and neonConfig.webSocketConstructor setup are NO LONGER NEEDED —
// @prisma/adapter-neon bundles everything required internally. Keeping the
// old manual setup actively causes hanging/broken WebSocket connections.

// DATABASE_APP_URL, when set, connects the running application as a
// restricted Postgres role (see scripts/create-app-runtime-role.ts) instead
// of the DATABASE_URL owner role. This matters for Row-Level Security
// (Phase 4, Stage 3): Neon's default owner role has the BYPASSRLS attribute,
// which makes RLS policies a no-op regardless of ENABLE/FORCE ROW LEVEL
// SECURITY on the tables themselves. Falls back to DATABASE_URL when unset —
// migrations always use DATABASE_URL (the owner role) directly via
// prisma.config.ts, since the restricted role has no DDL privileges.
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_APP_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({ adapter });
}

// ─── Lazy Singleton Pattern ───────────────────────────────────────────────
// Prisma client is created on first actual use (via the Proxy below), not at
// module import time. This avoids a race condition where this module could
// otherwise be evaluated before Next.js has finished loading .env.local into
// process.env, which previously caused DATABASE_URL to read as undefined.

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  return globalThis.prismaGlobal;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ─── Transaction Client Type ─────────────────────────────────────────────
// Prisma 7 with the Neon adapter does not export Prisma.TransactionClient
// from @prisma/client. Derived from PrismaClient for use inside
// $transaction callbacks (used in app/api/merchant/setup/route.ts and
// app/api/merchant/api-keys/route.ts — do not remove this export).
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ─── Row-Level Security tenant context (Phase 4, Stage 3) ────────────────
// Tables with RLS enabled (see prisma/migrations/*_enable_rls_*) reject every
// row unless the Postgres session has `app.current_org_id` set to a matching
// organizationId, or `app.is_platform_query` set to 'true' for the documented
// cross-org admin/callback-correlation lookups. This is defense-in-depth
// BEHIND the existing `lib/repositories/*` application-level scoping, not a
// replacement for it — every repository function must still take
// `organizationId` and filter by it explicitly.
//
// `set_config(..., true)` is Postgres's parameterized equivalent of
// `SET LOCAL`: the setting only lives for the current transaction, so it can
// never leak between requests even when the lazy global Prisma client above
// is reused across warm serverless invocations. It MUST run inside the same
// transaction as the query it's meant to scope — a bare `SET`/`set_config`
// outside a transaction (or in a separate one) would not apply.
//
// Only tables actually migrated to ENABLE + FORCE ROW LEVEL SECURITY are
// affected by this; other tables behave exactly as before regardless of
// whether a caller wrapped its query in one of these helpers.

/** Scopes every query inside `fn` to `organizationId` for RLS-enabled tables. */
export async function withTenantContext<T>(
  organizationId: string,
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return fn(tx);
  });
}

/**
 * Bypasses the tenant-isolation policy for the documented, deliberately
 * cross-organization lookups (e.g. API-key authentication resolving which
 * org a key belongs to, C2B shortcode correlation, the admin console). Only
 * call this from a call site that's already documented as intentionally
 * un-scoped — never from ordinary merchant-facing repository code.
 */
export async function withPlatformContext<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.is_platform_query', 'true', true)`;
    return fn(tx);
  });
}
