import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

// ─── Read-replica-ready DB layer (Phase 4, Stage 6) ──────────────────────
// DATABASE_REPLICA_URL, when set, points admin/reporting reads at a Neon
// read replica branch so they never contend with the transactional write
// path. Ships as a no-op today: with no replica provisioned, this falls back
// to the exact same client as lib/db.ts, so there's zero behavior change
// until the env var is actually set. Provisioning a real replica is
// deliberately deferred until admin/reporting queries measurably contend
// with the transactional path (see AGENTS.md) — not done preemptively here.
//
// Only route genuinely read-heavy, non-transactional admin/reporting queries
// through this client (e.g. the admin organizations list, billing/MRR
// snapshot, reconciliation-mismatch list). Never route anything in the
// payment-write path or any `lib/repositories/*` tenant-scoped function
// through it — those stay on the primary `prisma` client from lib/db.ts.

declare global {
  var prismaReadonlyGlobal: PrismaClient | undefined;
}

function createReadonlyClient(): PrismaClient {
  const connectionString = process.env.DATABASE_REPLICA_URL;
  if (!connectionString) {
    // No replica configured — reuse the primary client rather than opening a
    // second connection pool to the same database for no benefit.
    return prisma;
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function getReadonlyPrismaClient(): PrismaClient {
  if (!globalThis.prismaReadonlyGlobal) {
    globalThis.prismaReadonlyGlobal = createReadonlyClient();
  }
  return globalThis.prismaReadonlyGlobal;
}

export const prismaReadonly = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getReadonlyPrismaClient();
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
