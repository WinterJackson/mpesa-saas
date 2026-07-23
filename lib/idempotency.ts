import { redis } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Cache-and-replay idempotency for money-movement endpoints. Upstash Redis is
// the fast path; a Postgres IdempotencyRecord is the durable fallback so a replay
// still returns the cached response if Redis is down/unconfigured or the key was
// evicted. Keyed by organizationId (1:1 with merchant), NOT a destructive lock.

const TTL_SECONDS = 86_400; // 24h
type CachedResponse = { data: unknown; status: number };

function composite(organizationId: string, idempotencyKey: string) {
  return `${organizationId}:${idempotencyKey}`;
}

export async function getCachedIdempotentResponse(
  idempotencyKey: string,
  organizationId: string
): Promise<CachedResponse | null> {
  const key = composite(organizationId, idempotencyKey);

  // 1. Fast path — Redis.
  if (redis) {
    try {
      const cached = await redis.get<CachedResponse>(`idempotency:${key}`);
      if (cached) return cached;
    } catch (err) {
      logger.warn('[Idempotency] Redis read failed, falling back to Postgres:', err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Durable fallback — Postgres (also covers Redis eviction / not configured).
  try {
    const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
    if (record && record.expiresAt > new Date()) {
      const response = { data: record.responseData, status: record.status };
      // Re-warm Redis for subsequent replays.
      if (redis) {
        try {
          await redis.set(`idempotency:${key}`, response, { ex: TTL_SECONDS });
        } catch {
          /* best-effort */
        }
      }
      return response as CachedResponse;
    }
  } catch (err) {
    logger.error('[Idempotency] Postgres read failed:', err instanceof Error ? err.message : String(err));
  }

  return null;
}

export async function cacheIdempotentResponse(
  idempotencyKey: string,
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseData: any,
  status: number
): Promise<void> {
  const key = composite(organizationId, idempotencyKey);
  const response = { data: responseData, status };

  // Fast path.
  if (redis) {
    try {
      await redis.set(`idempotency:${key}`, response, { ex: TTL_SECONDS });
    } catch (err) {
      logger.warn('[Idempotency] Redis write failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Durable write-through.
  try {
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
    await prisma.idempotencyRecord.upsert({
      where: { key },
      update: { status, responseData, expiresAt },
      create: { key, organizationId, status, responseData, expiresAt },
    });
  } catch (err) {
    logger.error('[Idempotency] Postgres write failed:', err instanceof Error ? err.message : String(err));
  }
}
