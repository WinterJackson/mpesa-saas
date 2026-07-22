import { redis } from '@/lib/rate-limit';

export async function getCachedIdempotentResponse(idempotencyKey: string, merchantId: string) {
  if (!redis) return null;
  const key = `idempotency:${merchantId}:${idempotencyKey}`;
  const cached = await redis.get<{ data: unknown; status: number }>(key);
  return cached || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheIdempotentResponse(idempotencyKey: string, merchantId: string, responseData: any, status: number) {
  if (!redis) return;
  const key = `idempotency:${merchantId}:${idempotencyKey}`;
  // Cache for 24 hours
  await redis.set(key, { data: responseData, status }, { ex: 86400 });
}
