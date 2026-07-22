import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const isConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = isConfigured ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

// Dummy limiter for local development without Redis
const dummyLimiter = {
  limit: async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() }),
};

export const paymentApiRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/paymentApi',
}) : dummyLimiter;

export const callbackRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/callback',
}) : dummyLimiter;

export const generalRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/general',
}) : dummyLimiter;

export async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  if (!isConfigured || !redis) return true; // Always allow if not configured
  // Returns true if key doesn't exist (can proceed), false if it does (duplicate)
  const result = await redis.set(`idempotency:${idempotencyKey}`, '1', { nx: true, ex: 86400 }); // Expire in 24 hours
  return result === 'OK';
}
