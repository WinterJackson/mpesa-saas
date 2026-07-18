import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// ─── Prisma 7 + NeonDB Serverless Adapter (current, simplified API) ─────────
// As of the current @prisma/adapter-neon release, PrismaNeon accepts a plain
// { connectionString } object directly. Manual Pool construction, the `ws`
// package, and neonConfig.webSocketConstructor setup are NO LONGER NEEDED —
// @prisma/adapter-neon bundles everything required internally. Keeping the
// old manual setup actively causes hanging/broken WebSocket connections.

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

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
  // eslint-disable-next-line no-var
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
    return (client as any)[prop];
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
