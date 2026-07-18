import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// ─── Prisma 7 + NeonDB Serverless Adapter ────────────────────────────────────
// Prisma 7 removed the built-in Rust query engine. All database connections
// now go through explicit driver adapters. For NeonDB on Vercel serverless,
// we use @prisma/adapter-neon which uses Neon's HTTP-based serverless driver
// (no persistent TCP connections — perfect for serverless cold starts).
//
// In non-edge environments (Node.js), we need the 'ws' WebSocket library.
// We only import it in Node environments to avoid breaking edge runtimes.

if (typeof globalThis.WebSocket === 'undefined') {
  try {
    // Dynamic import to avoid bundling ws in edge environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require('ws');
  } catch {
    // If ws is not available (edge runtime), Neon falls back to HTTP fetch
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString });
  // @ts-expect-error type mismatch between @neondatabase/serverless versions
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({ adapter });
}

// ─── Lazy Singleton Pattern ──────────────────────────────────────────────────
// The Prisma client is created lazily on first use, NOT at module import time.
// This ensures process.env.DATABASE_URL is available (Next.js loads .env.local
// after module initialization in some cases, especially during Turbopack dev).
// In production on Vercel, this is safe because env vars are always set.

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (globalThis.prismaGlobal) return globalThis.prismaGlobal;

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = (client as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// ─── Transaction Client Type ─────────────────────────────────────────────────
// Prisma 7 with the Neon adapter does not export `Prisma.TransactionClient`
// from `@prisma/client`. We derive the type from our own PrismaClient instance
// to maintain full type safety inside `$transaction` callbacks.
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
